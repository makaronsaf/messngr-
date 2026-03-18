#!/bin/bash
set -e

echo "🚀 Setting up Messngr..."

# Check dependencies
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required. Aborting." >&2; exit 1; }

# Copy env if needed
if [ ! -f .env ]; then
  echo "📝 Creating .env from example..."
  cp packages/backend/.env.example .env
  echo "⚠️  Please edit .env and set your OAuth credentials and JWT_SECRET!"
fi

# Start infrastructure services first
echo "🐳 Starting infrastructure services..."
docker-compose up -d postgres redis elasticsearch

# Wait for postgres
echo "⏳ Waiting for PostgreSQL..."
until docker-compose exec -T postgres pg_isready -U messngr -d messngr_db; do
  sleep 2
done

echo "✅ Infrastructure ready!"

# Install backend deps & run migrations
echo "📦 Installing backend dependencies..."
cd packages/backend
npm install
npx prisma generate
echo "🔄 Running database migrations..."
DATABASE_URL=$(grep DATABASE_URL ../../.env | cut -d'=' -f2) npx prisma migrate dev --name init
cd ../..

# Install web deps
echo "📦 Installing web dependencies..."
cd packages/web && npm install && cd ../..

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start in development mode:"
echo "  Backend:  cd packages/backend && npm run dev"
echo "  Web:      cd packages/web && npm run dev"
echo ""
echo "To start with Docker:"
echo "  docker-compose up --build"
echo ""

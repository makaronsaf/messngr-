#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# init-ssl.sh — First-time Let's Encrypt certificate setup for makaronsaff.sbs
#
# Usage:
#   chmod +x scripts/init-ssl.sh
#   ./scripts/init-ssl.sh
#
# Requirements:
#   • DNS for makaronsaff.sbs must already point to this server's IP
#   • Ports 80 and 443 must be open
# ─────────────────────────────────────────────────────────────────────────────

set -e

DOMAIN="makaronsaff.sbs"
EMAIL="${CERTBOT_EMAIL:-admin@makaronsaff.sbs}"   # override with env var
COMPOSE="docker compose"

echo "==> Checking DNS for $DOMAIN ..."
if ! host "$DOMAIN" &>/dev/null; then
    echo "WARNING: Could not resolve $DOMAIN. Make sure DNS is pointed to this server."
fi

# ── Step 1: Create dummy certs so nginx can start ──────────────────────────
echo "==> Creating dummy certificates for initial nginx startup ..."
$COMPOSE run --rm --entrypoint "\
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
        -out    /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
        -subj '/CN=localhost'" certbot

# ── Step 2: Download recommended TLS options from certbot ─────────────────
echo "==> Downloading recommended TLS options ..."
$COMPOSE run --rm --entrypoint "\
    sh -c '\
        if [ ! -f /etc/letsencrypt/options-ssl-nginx.conf ]; then \
            curl -sS https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
                -o /etc/letsencrypt/options-ssl-nginx.conf; \
        fi; \
        if [ ! -f /etc/letsencrypt/ssl-dhparams.pem ]; then \
            curl -sS https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem \
                -o /etc/letsencrypt/ssl-dhparams.pem; \
        fi'" certbot

# ── Step 3: Start nginx with dummy certs ──────────────────────────────────
echo "==> Starting nginx ..."
$COMPOSE up -d nginx

# ── Step 4: Request real certificate ──────────────────────────────────────
echo "==> Requesting Let's Encrypt certificate for $DOMAIN ..."
$COMPOSE run --rm --entrypoint "\
    certbot certonly --webroot \
        --webroot-path /var/www/certbot \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN \
        -d www.$DOMAIN" certbot

# ── Step 5: Reload nginx with real certs ──────────────────────────────────
echo "==> Reloading nginx with real certificates ..."
$COMPOSE exec nginx nginx -s reload

echo ""
echo "✓ SSL setup complete!"
echo "  https://$DOMAIN is now live."
echo ""
echo "  Certbot will auto-renew certificates every 12 hours."
echo "  To renew manually: docker compose run --rm certbot certbot renew"

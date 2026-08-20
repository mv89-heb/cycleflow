import os
import logging
from flask import Flask, render_template, send_from_directory, make_response, jsonify

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

_secret_key = os.environ.get('SECRET_KEY')
if not _secret_key:
    if os.environ.get('RENDER'):
        raise RuntimeError('SECRET_KEY must be configured in production')
    _secret_key = os.urandom(32).hex()
    logger.warning('SECRET_KEY not configured; using a temporary development-only key.')
app.config.update(
    SECRET_KEY=_secret_key,
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
)

DEBUG_MODE = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'


@app.after_request
def set_security_headers(resp):
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    resp.headers['X-Frame-Options'] = 'DENY'
    resp.headers['Referrer-Policy'] = 'no-referrer'
    resp.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
    resp.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
    resp.headers['Cross-Origin-Resource-Policy'] = 'same-origin'
    resp.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    resp.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; "
        "script-src 'self' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
        "img-src 'self' data: blob:; "
        "connect-src 'self'; "
        "worker-src 'self' blob:; object-src 'none'"
    )
    return resp


@app.context_processor
def inject_asset_version():
    def asset_version(rel_path):
        full_path = os.path.join(app.static_folder, rel_path)
        try:
            return int(os.path.getmtime(full_path))
        except OSError:
            return 0
    return {'asset_version': asset_version}


@app.route('/health')
def health():
    return jsonify(status='ok'), 200


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/static/sw.js')
def service_worker():
    resp = make_response(send_from_directory(app.static_folder, 'sw.js'))
    resp.headers['Service-Worker-Allowed'] = '/'
    resp.headers['Content-Type'] = 'application/javascript; charset=utf-8'
    resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return resp


@app.errorhandler(404)
def page_not_found(e):
    return render_template('index.html'), 404


@app.errorhandler(500)
def server_error(e):
    logger.exception('Unhandled server error')
    return render_template('index.html'), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=DEBUG_MODE)

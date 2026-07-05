import os
import logging
from flask import Flask, render_template, send_from_directory, make_response

# הגדרת מערכת לוגים מקצועית למעקב אחרי שגיאות בייצור
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# מפתח אבטחה לסשנים - נדרש ממשתנה סביבה, ללא נפילה לערך קשיח (Critical fix)
_secret_key = os.environ.get('SECRET_KEY')
if not _secret_key:
    _secret_key = os.urandom(32).hex()
    logger.warning(
        "SECRET_KEY לא הוגדר במשתני הסביבה. נוצר מפתח זמני אקראי לתהליך זה בלבד "
        "(יתאפס בכל הפעלה מחדש - הגדירו SECRET_KEY קבוע בסביבת הייצור)."
    )
app.config['SECRET_KEY'] = _secret_key

# מצב Debug נשלט אך ורק דרך משתנה סביבה, ולעולם לא דלוק כברירת מחדל בייצור (Critical fix)
DEBUG_MODE = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'


@app.after_request
def set_security_headers(resp):
    """ כותרות אבטחה מומלצות (OWASP) - הגנה מפני clickjacking, sniffing ודליפת referrer """
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    resp.headers['X-Frame-Options'] = 'DENY'
    resp.headers['Referrer-Policy'] = 'no-referrer'
    resp.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
    return resp


@app.context_processor
def inject_asset_version():
    """ מוסיף מספר גרסה (mtime) לקבצים סטטיים כדי למנוע קאשינג ישן בדפדפן/שרת """
    def asset_version(rel_path):
        full_path = os.path.join(app.static_folder, rel_path)
        try:
            return int(os.path.getmtime(full_path))
        except OSError:
            return 0
    return dict(asset_version=asset_version)


@app.route('/')
def index():
    """ מגיש את אפליקציית הלקוח (Single Page Application) """
    logger.info("Serving the main application interface.")
    return render_template('index.html')


@app.route('/static/sw.js')
def service_worker():
    """ מגיש את ה-Service Worker עם scope שורש כדי שיוכל לשלוט בכל האפליקציה """
    resp = make_response(send_from_directory(app.static_folder, 'sw.js'))
    resp.headers['Service-Worker-Allowed'] = '/'
    resp.headers['Content-Type'] = 'application/javascript'
    return resp


@app.errorhandler(404)
def page_not_found(e):
    """ טיפול שגיאות 404 אלגנטי לחווית משתמש """
    logger.warning(f"404 Error: {e}")
    return render_template('index.html'), 404


@app.errorhandler(500)
def server_error(e):
    """ טיפול שגיאות שרת - לא חושף פרטים פנימיים למשתמש """
    logger.error(f"500 Error: {e}")
    return render_template('index.html'), 500


if __name__ == '__main__':
    # משיכת פורט ממשתני הסביבה (קריטי לפריסה בשרתי ענן כמו Render)
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=DEBUG_MODE)

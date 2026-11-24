FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --system --uid 10001 connect && mkdir -p /app/data && chown connect:connect /app/data
COPY app.py index.html admin.html logo.webp ./
USER connect
ENV CONNECT_DB=/app/data/connect.sqlite3 PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["gunicorn","--bind","0.0.0.0:8000","--workers","2","--threads","4","--timeout","45","app:application"]

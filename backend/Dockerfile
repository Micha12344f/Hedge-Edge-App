# Dockerfile for Hedge Edge License API
# Optimized for production deployment on Railway, Render, or any container platform

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.production.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.production.txt

# Copy application code
COPY license_api_production.py .

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash appuser && \
    chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Expose port
EXPOSE ${PORT:-8000}

# Run with gunicorn for production
CMD ["sh", "-c", "gunicorn license_api_production:app --bind 0.0.0.0:${PORT:-8000} --workers 4 --worker-class uvicorn.workers.UvicornWorker --access-logfile - --error-logfile - --timeout 120"]

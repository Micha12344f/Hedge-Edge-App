FROM scottyhardy/docker-wine:latest

ENV DISPLAY=:99
ENV WINEDEBUG=-all
ENV WORKER_ID=1
ENV WINEPREFIX=/root/.wine
ENV WINEARCH=win64
ENV MT5_SETUP_URL="https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe"
ENV MT5_INSTALL_DIR="C:/Program Files/MetaTrader 5"
ENV MT5_TERMINAL_PATH="C:/Program Files/MetaTrader 5/terminal64.exe"
ENV XDG_RUNTIME_DIR=/tmp/runtime-root
ENV WINEDLLOVERRIDES="mscoree,mshtml="

USER root

# Install dependencies (include winbind/cabextract to satisfy common Wine installer deps)
RUN apt-get update && apt-get install -y \
    supervisor \
    curl \
    net-tools \
    procps \
    xvfb \
    winbind \
    cabextract \
    && rm -rf /var/lib/apt/lists/*

# Initialize Wine prefix
RUN rm -f /tmp/.X99-lock /tmp/.X11-unix/X99; \
    xvfb-run -a -s "-screen 0 1024x768x16" wineboot --init && \
    sleep 5

# Install MetaTrader 5
RUN rm -f /tmp/.X99-lock /tmp/.X11-unix/X99; \
    xvfb-run -a -s "-screen 0 1024x768x16" sh -c "\
      wget -O /tmp/mt5setup.exe \"$MT5_SETUP_URL\" && \
      (timeout 420 wine /tmp/mt5setup.exe /auto /silent /dir=\"C:\\\\MetaTrader5\" || true) && \
      sleep 25 && \
      find /root/.wine/drive_c -iname 'terminal64.exe' -print | head -n 1 \
    " && rm -f /tmp/mt5setup.exe

# Install Python (Windows) under Wine
RUN rm -f /tmp/.X99-lock /tmp/.X11-unix/X99; \
    xvfb-run -a -s "-screen 0 1024x768x16" sh -c "\
      wget -O /tmp/python-installer.exe 'https://www.python.org/ftp/python/3.11.7/python-3.11.7-amd64.exe' && \
      (timeout 300 wine /tmp/python-installer.exe /quiet InstallAllUsers=1 PrependPath=1 || true) && \
      sleep 10 \
    " && rm -f /tmp/python-installer.exe

# Install Python packages in Wine Python
RUN rm -f /tmp/.X99-lock /tmp/.X11-unix/X99; \
    xvfb-run -a -s "-screen 0 1024x768x16" wine python -m pip install --upgrade pip && \
    rm -f /tmp/.X99-lock /tmp/.X11-unix/X99; \
    xvfb-run -a -s "-screen 0 1024x768x16" wine python -m pip install MetaTrader5 flask flask-cors pytz requests && \
    (wineserver -k || true)

# Copy application files
COPY mt5_worker_api.py /app/mt5_worker_api.py
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT []
CMD ["/bin/bash", "/start.sh"]

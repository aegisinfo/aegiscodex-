#!/bin/bash

if type update-alternatives 2>/dev/null >&1; then
    if [ -L '/usr/bin/aegiscode-gui' ] && [ -e '/usr/bin/aegiscode-gui' ] && [ "$(readlink '/usr/bin/aegiscode-gui')" != '/etc/alternatives/aegiscode-gui' ]; then
        rm -f '/usr/bin/aegiscode-gui'
    fi
    update-alternatives --install '/usr/bin/aegiscode-gui' 'aegiscode-gui' '/opt/AEGIS Code/aegiscode-gui' 100 || ln -sf '/opt/AEGIS Code/aegiscode-gui' '/usr/bin/aegiscode-gui'
else
    ln -sf '/opt/AEGIS Code/aegiscode-gui' '/usr/bin/aegiscode-gui'
fi

cat > '/usr/local/bin/ags' << 'WRAPPER'
#!/bin/sh
rm -f "$HOME/.config/aegiscode-gui/SingletonLock" \
      "$HOME/.config/aegiscode-gui/SingletonCookie" \
      "$HOME/.config/aegiscode-gui/SingletonSocket" 2>/dev/null
exec "/opt/AEGIS Code/aegiscode-gui" "$@"
WRAPPER
chmod +x '/usr/local/bin/ags'

# Write desktop entry with SingletonLock cleanup in Exec
cat > /usr/share/applications/aegiscode-gui.desktop << 'DESKTOP_EOF'
[Desktop Entry]
Name=AEGIS Code
Exec=/bin/sh -c 'rm -f "$HOME/.config/aegiscode-gui/SingletonLock" "$HOME/.config/aegiscode-gui/SingletonCookie" "$HOME/.config/aegiscode-gui/SingletonSocket" 2>/dev/null; exec "/opt/AEGIS Code/aegiscode-gui"'
Terminal=false
Type=Application
Icon=aegiscode-gui
Categories=Development;
StartupWMClass=AEGIS Code
DESKTOP_EOF

if ! { [[ -L /proc/self/ns/user ]] && unshare --user true; }; then
    chmod 4755 '/opt/AEGIS Code/chrome-sandbox' || true
else
    chmod 0755 '/opt/AEGIS Code/chrome-sandbox' || true
fi

if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi

if hash gtk-update-icon-cache 2>/dev/null; then
    gtk-update-icon-cache -f -t /usr/share/icons/hicolor || true
fi

#!/bin/bash

if type update-alternatives 2>/dev/null >&1; then
    if [ -L '/usr/bin/aegiscode-gui' -a -e '/usr/bin/aegiscode-gui' -a "`readlink '/usr/bin/aegiscode-gui'`" != '/etc/alternatives/aegiscode-gui' ]; then
        rm -f '/usr/bin/aegiscode-gui'
    fi
    update-alternatives --install '/usr/bin/aegiscode-gui' 'aegiscode-gui' '/opt/AEGIS Code/aegiscode-gui' 100 || ln -sf '/opt/AEGIS Code/aegiscode-gui' '/usr/bin/aegiscode-gui'
else
    ln -sf '/opt/AEGIS Code/aegiscode-gui' '/usr/bin/aegiscode-gui'
fi

ln -sf '/opt/AEGIS Code/aegiscode-gui' '/usr/local/bin/ags'

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

mkdir -p $HOME/hovercraft &&
# download tar file and untar in ~/hovercraft
curl http://now.she.codes/hovercraft/hovercraft.tar.gz | tar -xz -C $HOME/hovercraft &&

cat << EOF > $HOME/.config/autostart/hovercraft.desktop
[Desktop Entry]
Name[en]=Hovercraft
Name[de]=Hovercraft
Comment[en]=for Cordula 
Comment[de]=für Cordula 
Exec=$HOME/hovercraft/hovercraft-linux-x64/hovercraft\n
Icon=application-default-icon
X-GNOME-Autostart-enabled=true
Type=Application
EOF


## How to contribute

### Prerequisites
Hovercraft is made for Ubuntu 14.x or later.
You need to have Node 5.10.0 installed before you can run `npm install`. (If you have a different version of Node installed while running `npm install`, the native modules will not be compatible with the version of electron we use)

Use [nvm](https://github.com/creationix/nvm) to easily switch between Node versions.

Additionally, to build node-xtest-bindings (the module that actually fakes mouse clicks), you need to have the xtest library development files installed.

```
sudo apt-get install libxtst-dev
nvm use 5.10.0
npm i
```

After waiting quite a while, you can then run hovercraft.

```
npm start
```

## How do I start applications automatically on login?

[![Join the chat at https://gitter.im/shecodes-students/hovercraft](https://badges.gitter.im/shecodes-students/hovercraft.svg)](https://gitter.im/shecodes-students/hovercraft?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
http://askubuntu.com/questions/48321/how-do-i-start-applications-automatically-on-login

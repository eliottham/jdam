FROM node:current-slim
RUN [ "apt-get", "update" ]
RUN [ "apt-get", "install", "-y", "ffmpeg" ]
WORKDIR /root/app
COPY package.json .
COPY . .
RUN [ "mv", "jdam-utils-temp", "../jdam-utils"]
RUN [ "mv", "mime-types-temp", "../mime-types"]
EXPOSE 48000 9231
RUN [ "npm", "install" ]
CMD [ "node", "--inspect=0.0.0.0:9231", "ffmpeg.mjs" ]

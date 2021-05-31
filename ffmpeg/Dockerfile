FROM node:current-slim
RUN [ "apt-get", "update" ]
RUN [ "apt-get", "install", "-y", "ffmpeg" ]
WORKDIR /root/app
COPY package.json .
RUN [ "npm", "install" ]
COPY . .
EXPOSE 48000 9231
CMD [ "node", "ffmpeg.mjs" ]

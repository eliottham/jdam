FROM node:current-slim
WORKDIR /root/app
COPY package.json .
COPY . .
RUN [ "mv", "jdam-utils-temp", "../jdam-utils"]
RUN [ "mv", "mime-types-temp", "../mime-types"]
EXPOSE 25052 25053 9230
RUN [ "npm", "install" ]
CMD [ "node", "--inspect=0.0.0.0:9230", "session.mjs" ]

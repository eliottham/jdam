FROM node:current-slim
WORKDIR /root/app
COPY package.json .
RUN [ "npm", "install" ]
COPY . .
EXPOSE 25052 25053 9230
CMD [ "node", "--inspect=0.0.0.0:9230", "session.mjs" ]

FROM node:current-slim

WORKDIR /root/app

COPY package.json .

RUN [ "npm", "install" ]

COPY . .

EXPOSE 25052

CMD [ "node", "session.mjs" ]

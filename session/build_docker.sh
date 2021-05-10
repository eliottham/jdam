docker build -t jdam/session .
docker rmi $(docker images -qa -f 'dangling=true')

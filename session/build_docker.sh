docker build -t jdam/test .
docker rmi $(docker images -qa -f 'dangling=true')

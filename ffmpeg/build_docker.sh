docker build -t jdam/ffmpeg .
docker rmi $(docker images -qa -f 'dangling=true')

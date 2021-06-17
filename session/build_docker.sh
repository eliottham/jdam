cp -r ../jdam-utils ./jdam-utils-temp
cp -r ../mime-types ./mime-types-temp
docker build -t jdam/session .
rm -r ./jdam-utils-temp
rm -r ./mime-types-temp
docker rmi $(docker images -qa -f 'dangling=true')

NAME=${1}
# CONTAINER=$(docker run --network=jdam-net -d --rm jdam/test -e NAME=${NAME})
CONTAINER=$(docker run --network=jdam-net -d --rm -e NAME="${NAME}" jdam/test)
IP_ADDR=$(docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${CONTAINER})
printf "{ \"container\": \"${CONTAINER:0:24}\", \"ip\": \"${IP_ADDR}\", \"name\": \"${NAME}\" }"

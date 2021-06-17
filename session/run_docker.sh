docker run \
  --network=jdam-net \
  -d  \
  -p 25052:25052 -p 25053:25053 -p 9230:9230 \
  --add-host=host.docker.internal:host-gateway \
  -e TITLE="Test Session" \
  -e DESCRIPTION="Test file uploads and downloads" \
  -e SESSION_LENGTH=24000 \
  -e BPM=120 \
  -e MEASURES=4 \
  -e PATTERN='[2,1,1,1]' \
  jdam/session

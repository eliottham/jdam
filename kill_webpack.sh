for pid in $(netstat -aon | grep -E '4001.*ESTABLISHED' | sed -E 's/^.*\w +([0-9]{5,})$/\1/'); do
  taskkill -f -pid ${pid}
done

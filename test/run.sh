#!/bin/bash

WD=$( cd "$(dirname "$(readlink $0 || echo $0)")" ; pwd -P )
command -v tmux >/dev/null || { echo "tmux is required"; exit 1; }
TESTS="$1"
tmux kill-session -t htcrawltest > /dev/null 2>&1
tput setaf 2
echo "Tests started at "`date` 
tput sgr0
echo -ne "" > $WD/test-results.log

tmux new-session -d -s htcrawltest "python3 -m http.server 9091 -b 127.0.0.1 -d $WD/testpages"

TEST_CMD="\
node $WD/unit.js $TESTS ;\
tmux kill-session -t htcrawltest \
"
tmux split-window -t htcrawltest "$TEST_CMD"

tmux a -t htcrawltest  > /dev/null 2>&1
tput setaf 1
cat $WD/test-results.log
tput setaf 2
echo "Tests finished at "`date` 
tput sgr0
rm $WD/test-results.log
exit 0
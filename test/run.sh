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
sleep 1

echo "Testing chrome-extension scaffold"
rm -rf "$WD/chrome-extension-test" > /dev/null 2>&1
node ../ui/cli/main.js lib scaffold "$WD/chrome-extension-test"
sed -i '' "s/require('htcrawl')/require('..\\/..')/g" "$WD/chrome-extension-test/prog.js"
echo -ne "\n\
setTimeout( async () => {\n\
    crawler.on('fetch', e => console.log('Test is OK'));\n\
    await crawler.page().evaluate(() => window.__PROBE__.UI.start());\n\
    setTimeout( async () => {\n\
        await crawler.page().evaluate(() => window.__PROBE__.UI.stop());\n\
        await crawler.browser().close();\n\
        process.exit(0);\n\
    }, 2000);\n\
}, 2000);\n\
" >> "$WD/chrome-extension-test/prog.js"
node "$WD/chrome-extension-test/prog.js" http://127.0.0.1:9091/fetch.html  | grep "Test is OK" > /dev/null
if [ $? -ne 0 ];then
    echo -ne "Extension test failed" >> $WD/test-results.log
fi
rm -rf "$WD/chrome-extension-test"

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
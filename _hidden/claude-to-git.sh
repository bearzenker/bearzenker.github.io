#!/bin/sh
#
# deploy claude design website
#
SITE=bearzenker
DEST=/opt/$SITE.github.io

DOWN=/home/doug/Downloads
# get the most recent downloaded file
FILE=$(ls -tr $DOWN | grep -i "^$SITE" | tail -1)
echo "Found [$FILE]"

# sometimes the downloaded file has a space in it
NOSP=$(echo $FILE | sed "s/ /_/g")
[ "$FILE" != "$NOSP" ] && mv "$DOWN/$FILE" "$DOWN/$NOSP" && FILE=$NOSP
echo "Using [$FILE]"

# update changed file & add new files, over write withou prompt
unzip -uo  $DOWN/$FILE -d $DEST


cd $DEST


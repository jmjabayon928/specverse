OLD_EMAIL="jabayon@calnetic.com"
CORRECT_NAME="Jeff Abayon"
CORRECT_EMAIL="jeff.abayon@gmail.com"

if [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL" ]; then
  export GIT_COMMITTER_NAME="$CORRECT_NAME"
  export GIT_COMMITTER_EMAIL="$CORRECT_EMAIL"
fi

if [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL" ]; then
  export GIT_AUTHOR_NAME="$CORRECT_NAME"
  export GIT_AUTHOR_EMAIL="$CORRECT_EMAIL"
fi

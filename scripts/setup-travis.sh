MYSQL_PWD=${DB_PASS} mysql -e "CREATE DATABASE ${DB_NAME}" -u${DB_USER}

npm install db-migrate -g
npm install db-migrate-mysql -g

MIGRATIONS_DIR="$(pwd)/node_modules/time-core/migrations"
DATABASE_CONFIG="$(pwd)/scripts/database-travis.json"

db-migrate up --migrations-dir $MIGRATIONS_DIR --config $DATABASE_CONFIG

exit 0

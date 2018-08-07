# Steps:

- for dev envoirenment make sure you overwrite the `TLD` and env variable on running docker-compose
```
export TLD=beer42.dev POSTGREST=http://postgrest.beer42.dev
nodemon --harmony-async-await app.js
```

- to start up all services use:

```
docker-compose up --remove-orphans -d
```

- to push to herok remote

```
git remote | parallel git push {} master
```

- to add mass configurations to heroku
```
git remote | parallel heroku config:set --app {} POSTGREST=http://postgrest.beer42.de API_URL=http://api.bookdepository.com NODE_ENV=production
```

-to stop all the workers 
```
seq 11 | parallel heroku ps:scale -a bookdepositoryapi-{} web=0
```

-to start all the workers 
```
seq 11 | parallel heroku ps:scale -a bookdepositoryapi-{} web=1
```

-to restart all the workers 
```
seq 11 | parallel heroku restart -a bookdepositoryapi-{}
```
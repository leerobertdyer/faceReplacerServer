const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const app = express();
const cors = require('cors');
const knex = require('knex');
const { user } = require('pg/lib/defaults');
const session = require('express-session');
const KnexSessionStore = require('connect-session-knex')(session);

//setting up main database with KNEX:
const db = knex({
    client: 'pg',
    connection: {
        host: '127.0.0.1',
        port: 5432,
        user: '',
        password: '',
        database: 'face-replacer'
    }
});

// setting up session db with KNEX 
//Does not appear to work. Will need to go further into the documentation...
const sessiondb = knex({
    client: 'pg',
    connection: {
        host: '127.0.0.1',
        port: 5432,
        user: '',
        password: '',
        database: 'sessiondb'
    }
})

const store = new KnexSessionStore({
    sessiondb,
    tablename: 'sessions', 
  });
 
//json translator middleware:
app.use(express.json());

//express session keeps track of user logins and stores them so they don't get logged out on a refresh
// ****NOTE**** I'll need to make the "secret" actually secret by using .env (not sure what that is yet)
app.use(session({
    secret: 'Tomato', 
    resave: false,            
    saveUninitialized: true,   
    cookie: { maxAge: 100000 },
    store,
    }),
    );   

//cors is used to make cross-origin requests. Likely needed because the app uses Clarifai API to access images from other websites:
app.use(cors())


// **********    HANDLERS    ********** //

//setting the homepage response to current list of users:
app.get('/', (req, res) => {
    db.select('*').from('users')
        .then(data => {
            console.log(data)
            res.json(data)
        })
})

// signin handler. Checks email and password against database. 
app.post('/signin', (req, res) => {
    db.select("email", "hash").from('login')
        .where("email", "=", req.body.email)
        .then(data => {
            bcrypt.compare(req.body.password, data[0].hash, function (err, result) {
                if (result) {
                    return db.select('*').from('users')
                        .where('email', '=', req.body.email)
                        .then(user => {
                            res.json(user[0])
                        })
                        .catch(err => {
                            res.status(400).json('unable to get user')
                        })
                }
                else {
                    res.status(400).json('Wrong Creds Bro')
                }

            });
        })
        .catch(err => {
            res.status(400).json('wrong credentials')
        })


})


// 'register' handler. Creates hash for password inserts into LOGIN and USERS using Transaction (TRX):
app.post('/register', (req, res) => {
    const { name, email, password } = req.body;
    bcrypt.hash(password, 10, (err, hash) => {
        db.transaction(trx => {
            trx.insert({
                hash: hash,
                email: email
            }).into('login')
                .returning('email')
                .then(loginEmail => {
                    return trx('users')
                        .returning('*')
                        .insert({
                            email: loginEmail[0].email,
                            name: name,
                            joined: new Date()
                        })
                        .then(user => {
                            res.json(user[0])
                        }).catch(err => res.status(400).json('unable to register'))
                })

                .then(trx.commit)
                .catch(trx.rollback)
        })
    });
})

// Profile Handler:
app.get('/profile/:id', (req, res) => {
    const { id } = req.params;
    db.select('url').from('photos').where('user_id', id)
        .then(user => {
            if (user.length) {
                const uniqueUrls = new Set();
                const removeDuplicates = user.filter(item => {
                    if (!uniqueUrls.has(item.url)) {
                        uniqueUrls.add(item.url);
                        return true;
                    }
                    return false;
                });

                res.json(removeDuplicates);
            } else {
                res.status(400).json('no submissions')
            }
        })
})

//This is where we save photo urls, and update the entires
app.put('/image', (req, res) => {
    const { id, url } = req.body;
    db.select('*')
        .from('photos')
        .where({ 'user_id': id, 'url': url })
        .then(existingURL => {
            if (existingURL.length > 0) {
                return res.json('Url already submitted')
            } else {
                return db.transaction(trx => {
                    trx
                        .insert({
                            user_id: id,
                            url: url
                        })
                        .into('photos')
                        .then(() => {
                            return trx('users')
                                .where('id', '=', id)
                                .increment('entries', 1)
                                .returning('entries');
                        })
                        .then(entries => {
                            res.json(entries[0]);
                        })
                        .then(trx.commit)
                        .catch(err => {
                            trx.rollback();
                            res.status(400).json({ error: 'Transaction failed.' });
                        });
                })
                    .catch(err => {
                        res.status(400).json({ error: 'Transaction failed.' });
                    });
            }
        })

});

app.listen(3001, () => {
    console.log('app is running on port 3001')
});
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const app = express();
const cors = require('cors')
const knex = require('knex');
const { user } = require('pg/lib/defaults');

//setting up database with KNEX:
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

//json translator middleware:
app.use(express.json());

//cors is used to make cross-origin requests. Likely needed because the app uses Clarifai API to access images from other websites:
app.use(cors())

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

// currently unused, but could make your own profile showing all photos using this:
app.get('/profile/:id', (req, res) => {
    const { id } = req.params;
    db.select('*').from('users').where('id', id)
        .then(user => {
            if (user.length) {
                res.json(user[0])
            } else {
                res.status(400).json('no such user')
            }

        })
})

//This is where we save photo urls, and update the entires
app.put('/image', (req, res) => {
    const { id } = req.body;
    console.log('Received id:', id); // Log the received id
    db('users')
        .where('id', '=', id)
        .increment('entries', 1)
        .returning('entries')
        .then(entries => {
            res.json(entries[0].entries);
        })
        .catch(error => {
            res.status(400).json({ error: 'Unable to get entries.' });
        });
});



app.listen(3001, () => {
    console.log('app is running on port 3001')
});
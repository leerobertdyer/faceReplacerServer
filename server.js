const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const app = express();
const cors = require('cors')


const database = {
    users: [
        {
            id: '123',
            name: 'john',
            password: 'cookies',
            email: "john@gmail.com",
            joined: new Date(),
            entries: 0
        },
        {
            id: '124',
            name: 'suzy',
            password: 'mumble',
            email: "suzy@gmail.com",
            joined: new Date(),
            entries: 0
        }
    ],
    login: [
        {
            id: '987',
            hash: '',
            email: 'john@gmail.com'
        }
    ]
}


app.use(bodyParser.json());
app.use(cors())
app.get('/', (req, res) => {
    res.send(database.users)
})

app.post('/signin', (req, res) => {
    if (req.body.email === database.users[0].email &&
        req.body.password === database.users[0].password) {
        res.json(database.users[0])
    }
    else {
        res.json('wrong login info...')
    }
})

let hashed;
app.post('/register', (req, res) => {
    const { name, email, password } = req.body;
    bcrypt.hash(password, 10, (err, hash) => {
        hashed = hash;
    });
    database.users.push(
        {
            id: 125,
            name: name,
            password: hashed,
            email: email,
            joined: new Date(),
            entries: 0
        }
    );
    console.log(database.users)
    res.json(database.users[database.users.length - 1])
})

app.post('/signin', (req, res) => {
    res.json('sign in')
})


app.get('/profile/:id', (req, res) => {
    const { id } = req.params;
    let found = false;
    database.users.forEach(user => {
        if (user.id === id) {
            found = true;
            return res.json(user)
        }
    })
    if (!found) {
        res.status(404).json('no such user')
    }
})

app.put('/image', (req, res) =>{
    const { id } = req.body;
    let found = false;
    database.users.forEach(user => {
        if (user.id === id) {
            found = true;
            user.entries++
            return res.json(user.entries)
        }
    })
    if (!found) {
        res.status(404).json('no such user')
    }
})

 




app.listen(3001, () => {
    console.log('app is running on port 3001')
});
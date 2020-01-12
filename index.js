const player = {
    x: 0,
    y: 0,
    speed: 0.5,
    friction: 0.9,
    attackPotency: 0,
    health: 100,
    cooldowns: new WeakMap(),
    attackCooldown: 0,
    size: 30,
    xVel: 0,
    yVel: 0
}
const ENEMY_MAX_HEALTH = 10;
let score = 0;

function adjacentNodes(body, node) {
    return [
        [node[0] + 30, node[1]],
        [node[0] - 30, node[1]],
        [node[0], node[1] - 30],
        [node[0], node[1] + 30]
    ].filter(node => nodes.some(([x, y]) => x === node[0] && y === node[1])).filter(node => {
        return !enemies.some(enemy => {
            if (enemy !== body) {
                if (node[0] >= enemy.x - 30 && node[0] <= enemy.x + 60 && node[1] >= enemy.y - 30 && node[1] <= enemy.y + 60) {
                    return true;
                }
            }
            return false;
        })
    });
}
let time = 0;
class PriorityQueue {
    constructor() {
        this.storage = {};
    }
    put(item, priority) {
        this.storage[item] = priority;
    }
    get() {
        const [item] = Object.entries(this.storage).reduce((t, v) => v[1] < t[1] ? v : t);
        delete this.storage[item];
        return item.split(",").map(x => Number(x));
    }
    get length() {
        return Object.keys(this.storage).length;
    }
    forEach(callback) {
        Object.entries(this.storage).map(x => x[0].split(",").map(x => Number(x))).forEach(callback);
    }
}

function direction(node1, node2) {
    if (node2[0] > node1[0]) {
        return 'left';
    }
    if (node2[0] < node1[0]) {
        return 'right';
    }
    if (node2[1] < node1[1]) {
        return 'down';
    }
    if (node2[1] > node1[1]) {
        return 'up';
    }
}

function Enemy() {
    return {
        x: round30(getWidth() * 0.75),
        y: round30(getHeight() * 0.75),
        speed: 0.5,
        state: "pursuit",
        probs: {
            pursuit: {
                pursuit: 1,
                retreat: 0
            },
            retreat: {
                pursuit: 0,
                retreat: 1
            }
        },
        friction: 0.85,
        attackPotency: 0,
        attackCooldown: 0,
        size: 30,
        xVel: 0,
        yVel: 0,
        step: 0,
        health: ENEMY_MAX_HEALTH,
        cooldown: 0,
        path: [],
        findPath() {
            time += 1;
            const cameFrom = {};
            const start = [round30(this.x), round30(this.y)]
            let frontier = new PriorityQueue();
            frontier.put(start, 0);
            const costSoFar = {
                [start]: 0
            }
            let last;
            let iter = 0;
            while (frontier.length !== 0 && iter < 100) {
                let current = frontier.get();
                if (this.state === "pursuit" && Math.abs(current[0] - player.x) <= 30 && Math.abs(current[1] - player.y) <= 30) {
                    last = current;
                    break;
                }
                adjacentNodes(this, current).forEach(node => {
                    const newCost = costSoFar[current] + 1;
                    if (!costSoFar[node] || newCost < costSoFar[node]) {
                        costSoFar[node] = newCost;
                        let priority;
                        if (this.state === "pursuit") {
                            priority = newCost + dist(node[0], node[1], player.x, player.y);
                        } else if (this.state === "retreat") {
                            priority = newCost - dist(node[0], node[1], player.x, player.y);
                        }
                        frontier.put(node, priority);
                        cameFrom[node] = current;
                    }
                })
                iter++;
            }
            if (!last) {
                last = (Object.keys(cameFrom).length === 0 ? [start.toString()] : Object.keys(cameFrom)).map(x => x.split(",")).reduce((t, v) => {
                    if (dist(v[0], v[1], player.x, player.y) < dist(t[0], t[1], player.x, player.y)) {
                        if (this.state === "pursuit") {
                            return v;
                        } else if (this.state === "retreat") {
                            return t;
                        }
                    }
                    if (this.state === "pursuit") {
                        return t;
                    } else if (this.state === "retreat") {
                        return v;
                    }
                });
            }
            let current = last;
            const path = [];
            while (current.toString() !== start.toString()) {
                path.push(direction(current, cameFrom[current]));
                current = cameFrom[current];
            }
            this.step = 0;
            this.path = path;
            return path.reverse();
        },
        move() {
            const move = this.path[this.step];
            switch (move) {
                case "up":
                    this.yVel -= this.speed;
                    break;
                case "down":
                    this.yVel += this.speed;
                    break;
                case "right":
                    this.xVel += this.speed;
                    break;
                case "left":
                    this.xVel -= this.speed;
                    break;
            }
            const xVel = this.xVel;
            const yVel = this.yVel;
            this.x += this.xVel;
            this.y += this.yVel;
            obstacles.forEach(obstacle => {
                if (check(this, obstacle)) {
                    this.x -= xVel;
                    this.y -= yVel;
                }
            })
            enemies.forEach(enemy => {
                if (enemy !== this) {
                    if (check(this, enemy)) {
                        this.xVel -= xVel * 2;
                        this.y -= yVel * 2;
                    }
                }
            })
            if (check(this, player)) {
                this.x -= xVel;
                this.y -= yVel;
            }
            if (this.x < 5) {
                this.x = 5;
            }
            if (this.x > width - this.size - 5) {
                this.x = width - this.size - 5;
            }
            if (this.y < 5) {
                this.y = 5;
            }
            if (this.y > height - this.size - 5) {
                this.y = height - this.size - 5;
            }
            this.xVel *= this.friction;
            this.yVel *= this.friction;
            const states = this.probs[this.state];
            const sum = Object.values(states).reduce((t, v) => t + v);
            const threshold = random(sum);
            let counter = 0;
            const oldState = this.state;
            this.state = Object.entries(states).sort(() => Math.random() - 0.5).find(([state, val]) => {
                counter += val;
                if (counter >= threshold) {
                    return true;
                }
            })[0];
            if (oldState === "retreat" && this.state === "pursuit") {
                this.probs.pursuit.retreat = 0;
                this.probs.pursuit.pursuit = 1;
            }
            if (oldState === "pursuit" && this.state === "retreat") {
                this.probs.retreat.pursuit = 0;
                this.probs.retreat.retreat = 1;
            }
            if (oldState === "retreat" && this.state === "retreat") {
                this.probs.retreat.pursuit += 0.000001 * dist(this.x, this.y, player.x, player.y);
                this.probs.retreat.retreat = 1 - this.probs.retreat.pursuit;

            }
        },
        attack() {
            this.attackPotency -= 0.05;
            if (dist(this.x, this.y, player.x, player.y) < 43 && this.attackCooldown < 0) {
                this.attackCooldown = 30;
                this.attackPotency = 1;
            }
            this.attackCooldown -= 1;
        },
        cc() {
            const increaseFactor = 0.95 + ((this.health / ENEMY_MAX_HEALTH) / 20)
            if (player.attackPotency > 0 && this.cooldown < 0) {
                if (this.x >= player.x - 90 && this.y >= player.y - 90 && this.x <= player.x + player.size + 120 && this.y <= player.y + player.size + 120) {
                    this.cooldown = 30;
                    this.health -= player.attackPotency;
                    if (this.probs.pursuit.retreat === 0) {
                        this.probs.pursuit.retreat = 0.01;
                    } else {
                        this.probs.pursuit.retreat **= increaseFactor;
                    }
                    this.probs.pursuit.pursuit = 1 - this.probs.pursuit.retreat;
                }
            }
            enemies.forEach(enemy => {
                if (enemy.state === "retreat" && Math.random() < 0.05) {
                    this.probs.pursuit.retreat **= Math.min(increaseFactor + (dist(this.x, this.y, enemy.x, enemy.y) / 120), 1);
                    this.probs.pursuit.pursuit = 1 - this.probs.pursuit.retreat;
                }
            })
            this.cooldown -= 1;
        }
    }
}
const enemies = [Enemy()];
player.cooldowns.set(enemies[0], 0);
const obstacles = [{
        x: round30(getWidth() / 2),
        y: round30(getHeight() / 2),
        width: round30(getWidth() / 2) - 3,
        height: 60
    }, {
        x: round30(getWidth() / 4),
        y: 3,
        width: 30,
        height: round30(getHeight() * 0.75)
    }, {
        x: round30(getWidth() * 0.75),
        y: round30(getHeight() / 6),
        width: 60,
        height: 60
    }, {
        x: round30(getWidth() * 0.5),
        y: round30(getHeight() / 6),
        width: 60,
        height: 60
    },
    {
        x: round30(getWidth() * 0.125) - 60,
        y: round30(getHeight() / 6),
        width: 60,
        height: 60
    }
];

const nodes = [];
for (let x = 0; x <= getWidth(); x += 30) {
    for (let y = 0; y <= getWidth(); y += 30) {
        if (obstacles.find(obstacle => {
                if (x >= obstacle.x - 5 && x <= obstacle.x + obstacle.width + 5 && y >= obstacle.y - 5 && y <= obstacle.y + obstacle.height + 5) {
                    return true;
                }
            })) {
            continue;
        }
        nodes.push([x, y]);
    }
}

function getWidth() {
    return round30(window.innerWidth * 0.75);
}

function getHeight() {
    return round30(window.innerHeight * 0.75);
}

function round30(num) {
    return Math.round(num / 30) * 30;
}

function setup() {
    nodes.forEach(node => {
        ellipse(node[0], node[1], 5, 5);
    })
    createCanvas(getWidth(), getHeight());
}
const moving = {
    up: false,
    down: false,
    left: false,
    right: false
}


function check(body, obstacle) {
    const ubx = body.x + body.xVel;
    const uby = body.y + body.yVel;
    if (ubx + 30 >= obstacle.x && uby + 30 >= obstacle.y && ubx <= obstacle.x + (obstacle.width || obstacle.size) && uby <= obstacle.y + (obstacle.height || obstacle.size)) {
        body.xVel = 0;
        body.yVel = 0;
        return true;
    }
    return false;
}
let iter = 0;

function draw() {
    background(0, 255, 0)
    if (player.health < 1) {
        player.health = 0;
        textSize(80);
        fill(0, 0, 0, 255);
        textAlign(CENTER);
        text("Game Over", width / 2, height / 2 - 20);
        textAlign(LEFT);
        noLoop();
    }
    strokeWeight(5);
    obstacles.forEach(obstacle => {
        fill(175, 175, 175)
        rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)
        check(player, obstacle);
    })
    fill(0)
    textSize(40)
    text("Health: " + player.health, width - 220, 40)
    text("Score: " + score, 10, 40)
    if (player.x < 5) {
        player.x = 5;
    }
    if (player.x > width - player.size - 5) {
        player.x = width - player.size - 5;
    }
    if (player.y < 5) {
        player.y = 5;
    }
    if (player.y > height - player.size - 5) {
        player.y = height - player.size - 5;
    }
    enemies.forEach(enemy => {
        player.cooldowns.set(enemy, player.cooldowns.get(enemy) - 1)
    })
    enemies.forEach(enemy => {
        fill(0, 0, 125, enemy.attackPotency * 255)
        strokeWeight(0);
        rect(enemy.x - 30, enemy.y - 30, enemy.size + 60, enemy.size + 60);
        strokeWeight(5);
        if (enemy.attackPotency > 0 && player.cooldowns.get(enemy) < 0) {
            if (player.x >= enemy.x - 60 && player.y >= enemy.y - 60 && player.x < enemy.x + 60 && player.y <= enemy.y + 60) {
                player.health -= enemy.attackPotency;
                player.cooldowns.set(enemy, 30);
            }
        }
    })
    fill(0, 125, 0, player.attackPotency * 255)
    strokeWeight(0);
    rect(player.x - 60, player.y - 60, player.size + 120, player.size + 120);
    strokeWeight(5);
    fill(0, 175, 0);
    rect(player.x, player.y, player.size, player.size);
    player.attackPotency -= 0.05;
    player.x += player.xVel;
    player.y += player.yVel;
    if (moving.right) {
        player.xVel += player.speed;
    }
    if (moving.left) {
        player.xVel -= player.speed;
    }
    if (moving.up) {
        player.yVel -= player.speed;
    }
    if (moving.down) {
        player.yVel += player.speed;
    }
    player.attackCooldown -= 1;
    player.xVel *= player.friction;
    player.yVel *= player.friction;
    iter++;
    if (iter % (120 * Math.floor(Math.max(enemies.length, 1) ** 1.3)) === 0) {
        const enemy = Enemy();
        player.cooldowns.set(enemy, 0);
        enemies.push(enemy);
    }
    enemies.forEach(enemy => {
        fill(255 - (enemy.health / ENEMY_MAX_HEALTH) * 255, 0, 175);
        rect(enemy.x, enemy.y, enemy.size, enemy.size);
        if (iter % 10 === 0) {
            enemy.findPath();
        }
        enemy.move();
        enemy.attack();
        enemy.cc();
        if (enemy.health <= 0) {
            enemies.splice(enemies.indexOf(enemy), 1);
            score += 1;
        }
        check(enemy, player)
        check(player, enemy)
        obstacles.forEach(obstacle => {
            check(enemy, obstacle)
        });
    })
}

function keyPressed() {
    if (key === "ArrowLeft") {
        moving.left = true;
        moving.right = false;
    }
    if (key === "ArrowRight") {
        moving.right = true;
        moving.left = false;
    }
    if (key === "ArrowUp") {
        moving.up = true;
        moving.down = false;
    }
    if (key === "ArrowDown") {
        moving.down = true;
        moving.up = false;
    }
    if (key === " " && player.attackCooldown < 1) {
        player.attackPotency = 1;
        player.attackCooldown = 30;
    }
}

function keyReleased() {
    if (key === "ArrowLeft") {
        moving.left = false;
    }
    if (key === "ArrowRight") {
        moving.right = false;
    }
    if (key === "ArrowUp") {
        moving.up = false;
    }
    if (key === "ArrowDown") {
        moving.down = false;
    }
}
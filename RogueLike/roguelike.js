/*
 * Contains the main object "RoguelikeGame", the top-level game object.
 */

var has_require = typeof require !== 'undefined';

if (typeof window !== 'undefined') {
    var ROT = window.ROT;
}

if (typeof ROT === 'undefined' ) {
    if (has_require) {
      ROT = require('./rot.js');
    }
    else throw new Error('roguelike requires ROT');
}

/** Main object of the package for encapsulating all other objects. */
var RG = { // {{{2 

    IdCount: 0,

    cellPropRenderOrder: ['actors', 'items', 'traps', 'elements'],

    /** Maps a cell to specific object in stylesheet. For rendering purposes
     * only.*/
    getStyleClassForCell: function(cell) {
        if (!cell.isExplored()) return "cell-not-explored";
        for (var i = 0; i < this.cellPropRenderOrder.length; i++) {
            var type = this.cellPropRenderOrder[i];
            if (cell.hasProp(type)) {
                var props = cell.getProp(type);
                var styles = this.cellStyles[type];
                var propType = props[0].getType();
                if (styles.hasOwnProperty(propType)) {
                    return styles[propType];
                }
                else {
                    return styles["default"];
                }
            }
        }

        var baseType = cell.getBaseElem().getType();
        return this.cellStyles.elements[baseType];
    },

    /** Returns char which is rendered on the map cell.*/
    getCellChar: function(cell) {
        if (!cell.isExplored()) return " ";
        if (cell.hasProp("items")) return "(";
        if (cell.hasProp("actors")) return "@";
        if (cell.hasPropType("wall")) return "#";
        if (cell.hasPropType("stairs")) {
            if (cell.getPropType("stairs")[0].isDown()) return ">";
            return "<";
        }
        return " ";
    },

    /** Returns shortest distance between two points.*/
    shortestDist: function(x0, y0, x1, y1) {
        var coords = [];
        var result = 0;
        var passableCallback = function(x, y) {return true;};
        var finder = new ROT.Path.Dijkstra(x0, y0, passableCallback);
        finder.compute(x1, y1, function(x, y) {
            ++result;
        });
        return result - 1; // Subtract one because starting cell included
    },

    cellStyles: {
        elements: {
            "default": "cell-elements",
            wall: "cell-element-wall",
            floor: "cell-element-floor",
        },
        actors: {
            "player": "cell-player",
            "monster": "cell-monster",
            "default": "cell-actors",
        },
        items: {
            "default": "cell-items",
        },
        traps: {
            "default": "cell-traps",
        },
    },

    debug: function(obj, msg) {
        var inst = typeof obj;
        if (0) console.log("[DEBUG]: " + inst + " " + msg);
    },

    err: function(obj, fun, msg) {
        console.error("[ERROR]: " + obj + ": " + fun + " -> " + msg);
    },


    extend2: function(Child, Parent) {
        var p = Parent.prototype;
        var c = Child.prototype;
        for (var i in p) {
            if (!c.hasOwnProperty(i)) {
                c[i] = p[i];
            }
            else {
                console.log(i + " overridden in the child class.");
            }
        }
        if (c.hasOwnProperty("uber")) {
            var ubers = [c.uber];
            ubers.push(p);
            c.uber = ubers;
        }
        else {
            c.uber = p;
        }
    },

    /** Prints an error into console if 'val' is null or undefined.*/
    nullOrUndefError: function(obj, msg, val) {
        if (this.isNullOrUndef([val])) {
            var type = typeof obj;
            console.error("nullOrUndefError: " + type + ": " + msg);
        }
    },

    /** Returns true if anything in the list is null or undefined.*/
    isNullOrUndef: function(list) {
        for (var i = 0; i < list.length; i++) {
            if (list[i] === null || typeof list[i] === "undefined" ||
                list === undefined) {
                return true;
            }
        }
        return false;
    },

    gameMsg: function(msg) {
        this.POOL.emitEvent(this.EVT_MSG, {msg: msg});
    },

    /** Checks if actor level can be increased.*/
    checkExp: function(actor) {
        var expLevel = actor.getExpLevel();
        var exp = actor.getExp();
        var nextLevel = expLevel + 1;
        var reqExp = 0;
        for (var i = 1; i <= nextLevel; i++) {
            reqExp += i * 10;
        }
        if (exp >= reqExp) {
            actor.setExpLevel(nextLevel);
            actor.setMaxHP(actor.getMaxHP() + 5);
            actor.setHP(actor.getHP() + 5);
            actor.setAttack(actor.getAttack() + 1);
            actor.setDefense(actor.getDefense() + 1);
            RG.gameMsg(actor.getName() + " advanced to level " + nextLevel);
        }

    },

    // Default FOV range for actors
    FOV_RANGE: 4,
    ROWS: 30,
    COLS: 50,
    ACTION_DUR: 100,
    DEFAULT_HP: 50,

    // Different game events
    EVT_ACTOR_KILLED: "EVT_ACTOR_KILLED",
    EVT_MSG: "EVT_MSG",
    EVT_LEVEL_CHANGED: "EVT_LEVEL_CHANGED",

}; /// }}} RG

/** Each die has number of throws, type of dice (d6, d20, d200...) and modifier
 * which is +/- X. */
RG.Die = function(num, dice, mod) {
    var _num = num;
    var _dice = dice;
    var _mod = mod;

    this.roll = function() {
        var res = 0;
        for (var i = 0; i < _num; i++) {
            res += Math.floor(Math.random() * (_dice+1));
        }
        return res + mod;
    };
};

RG.TypedObject = function(type) {
    var _type = type;

    this.setType = function(type) {
        _type = type;
        RG.nullOrUndefError(this, "arg |type|", type);
    };

    this.getType = function() {
        return _type;
    };

};


/** This object is used by all locatable objects in the game.  */
RG.Locatable = function() { // {{{2
    RG.TypedObject.call(this, null);
    var _x = null;
    var _y = null;
    var _level = null;

    /** Simple getters/setters for coordinates.*/
    this.setX = function(x) {_x = x; };
    this.setY = function(y) {_y = y; };
    this.getX = function() {return _x;};
    this.getY = function() {return _y;};
    this.getXY = function() { return [_x, _y];};
    this.setXY = function(x,y) {
        _x = x;
        _y = y;
    };


    /** Returns true if object is located at a position on a level.*/
    this.isLocated = function() {
        return (_x !== null) && (_y !== null) && (_level !== null);
    };

    /** Returns true if locatables are in same position.*/
    this.isSamePos = function(obj) {
        if (_x !== obj.getX()) return false;
        if (_y !== obj.getY()) return false;
        if (_level !== obj.getLevel()) return false;
        return true;
    };

    /** Sets the level of this locatable object.*/
    this.setLevel = function(level) {
        _level = level;
        RG.nullOrUndefError(this, "arg |level|", level);
    };

    this.getLevel = function() {
        return _level;
    };


}; // }}} Locatable
RG.extend2(RG.Locatable, RG.TypedObject);

/** Ownable is sort of Locatable but it moves with its owner. This ensures that
 * for example item coordinates are up-to-date with the carrier.*/
RG.Ownable = function(owner) {
    RG.TypedObject.call(this, null);
    var _owner = owner;

    this.isSamePos = function(obj) {return _owner.isSamePos(obj);};

    this.getLevel = function() {return _owner.getLevel();};

    this.setOwner = function(owner) {
        if (RG.isNullOrUndef([owner])) {
            RG.err("Item", "setOwner", "Owner cannot be null.");
        }
        else {
            _owner = owner;
        }
    };
    this.getOwner = function() {return _owner;};

    this.getX = function() {
        if (_owner !== null) return _owner.getX();
        return null;
    };

    this.getY = function() {
        if (_owner !== null) return _owner.getY();
        return null;
    };

    this.getLevel = function() {
        if (_owner !== null) return _owner.getLevel();
        return null;
    };

};
RG.extend2(RG.Ownable, RG.TypedObject);

/** Event pool can be used to emit events and register callbacks for listeners.
 * This decouples the emitter and listener from each other.  */
RG.EventPool = function() { // {{{2

    var _listeners = {};
    var _eventsNoListener = 0;

    /** Emits an event with given name. args must be in object-notation ie.
     * {data: "abcd"} */
    this.emitEvent = function (evtName, args) {
        if (_listeners.hasOwnProperty(evtName)) {
            var called = _listeners[evtName];
            for (var i = 0; i < called.length; i++) {
                called[i].notify(evtName, args);
            }
        }
        else {
            ++_eventsNoListener;
        }
    };

    /** Register an event listener. */
    this.listenEvent = function(evtName, obj) {
        if (obj.hasOwnProperty("notify")) {
            if (_listeners.hasOwnProperty(evtName)) {
                _listeners[evtName].push(obj);
            }
            else {
                _listeners[evtName] = [];
                _listeners[evtName].push(obj);
            }
        }
        else {
            console.error("Cannot add object. Listener must implement notify()!");
        }
    };
};
RG.POOL = new RG.EventPool(); // Global event pool for the game }}}

/** Handle the game message listening and storing of the messages.  */
RG.Messages = function() { // {{{2
    var _message = [];

    this.notify = function(evtName, msg) {
        if (evtName === RG.EVT_MSG) {
            if (msg.hasOwnProperty("msg")) {
                _message.push(msg.msg);
            }
        }
    };
    RG.POOL.listenEvent(RG.EVT_MSG, this);

    this.getMessages = function() {
        return _message.join(".");
    };

    this.clear = function() {
        _message = [];
    };

}; // }}} Messages

/** Top-level object for the game.  */
RG.RogueGame = function() { // {{{2

    var _cols = RG.COLS;
    var _rows = RG.ROWS;

    var _players      = [];
    var _levels       = [];
    var _activeLevels = [];
    var _shownLevel   = null;
    var _time         = "";
    var _gameOver     = false;

    var _mapGen = new RG.RogueMapGen();
    var _scheduler = new RG.RogueScheduler();
    var _msg = new RG.Messages();

    this.getMessages = function() {
        return _msg.getMessages();
    };

    this.clearMessages = function() {
        _msg.clear();
    };

    this.shownLevel = function() {return _shownLevel;};
    this.setShownLevel = function(level) {_shownLevel = level;};

    /** Returns next actor from the scheduling queue.*/
    this.nextActor = function() {
        return _scheduler.next();
    };

    this.isGameOver = function() {
        return _gameOver;
    };

    this.getPlayer = function() {
        if (_players.length > 0) {
            return _players[0];
        }
        else {
            RG.err("Game", "getPlayer", "There are no players in the game.");
        }
    };

    /** Adds player to the game. By default, it's added to the first level.*/
    this.addPlayer = function(player) {
        if (_levels.length > 0) {
            if (_levels[0].addActorToFreeCell(player)) {
                _players.push(player);
                _scheduler.add(player, true, 0);
                if (_shownLevel === null) {
                    _shownLevel = _levels[0];
                }
                RG.debug(this, "Added a player to the Game.");
                return true;
            }
            else {
                RG.err("Game", "addPlayer", "Failed to add the player.");
                return false;
            }
        }
        else {
            RG.err("Game", "addPlayer", "No levels exist. Cannot add player.");
        }
        return false;
    };

    /** Adds an actor to scheduler.*/
    this.addActor = function(actor) {
        _scheduler.add(actor, true, 0);
        if (actor.getLevel() === null) {
            RG.err("Game", "addActor", "actor has null level");
        }
    };

    this.addEvent = function(gameEvent) {
        _scheduler.add(gameEvent, true, 0);
    };

    this.addActorToLevel = function(actor, level) {
        var index = _levels.indexOf(level);
        if (index >= 0) {
            if (_levels[0].addActorToFreeCell(actor)) {
                _scheduler.add(actor, true, 0);
                return true;
            }
            else {
                RG.err("Game", "addActorToLevel", "Failed to add the actor.");
            }
        }
        else {
            RG.err("Game", "actorToLevel", "No level exist. Cannot add actor.");
        }
        return false;
    };

    this.doAction = function(action) {
        _scheduler.setAction(action);
        action.doAction();
    };

    this.addLevel = function(level) {
        _levels.push(level);
        _activeLevels.push(level);
    };

    this.getActiveLevels = function() {
        return _activeLevels;
    };

    /* Returns the visible map to be rendered by GUI. */
    this.getVisibleMap = function() {
        var player = this.getPlayer();
        var map = player.getLevel().getMap();
        return map;
    };

    this.moveActorTo = function(actor, x, y) {
        var level = actor.getLevel();
        return level.moveActorTo(actor, x, y);
    };

    this.notify = function(evtName, args) {
        if (evtName === RG.EVT_ACTOR_KILLED) {
            if (args.actor.isPlayer()) {
                if (_players.length === 1) {
                    _gameOver = true;
                    RG.gameMsg("GAME OVER!");
                    console.log("Captured game over!");
                }
            }
        }
        else if (evtName === RG.EVT_LEVEL_CHANGED) {
            var actor = args.actor;
            if (actor.isPlayer()) {
                _shownLevel = actor.getLevel();
            }
            console.log("Captured level changed.");
        }
    };
    RG.POOL.listenEvent(RG.EVT_ACTOR_KILLED, this);
    RG.POOL.listenEvent(RG.EVT_LEVEL_CHANGED, this);

}; // }}} Game

/** Object for the game levels. Contains map, actors and items.  */
RG.RogueLevel = function(cols, rows) { // {{{2
    var _map = null;

    // Level properties
    var _p = {
        actors: [],
        items:  [],
        elements: [],
        stairs: [],
    };

    this.setMap = function(map) {
        _map = map;
    };
    this.getMap = function() {
        return _map;
    };

    /** Returns all properties in a given location.*/
    this.getProps = function(x, y) {
        if (!RG.isNullOrUndef([x, y])) {
            console.error("getProps in RogueLevel not implemented.");
        }
        else {
            RG.nullOrUndefError(this, "arg |x|", x);
            RG.nullOrUndefError(this, "arg |y|", y);
            return null;
        }
    };

    /** Given a level, returns stairs which lead to that level.*/
    this.getStairs = function(level) {
        for (var i = 0; i < _p.stairs.length; i++) {
            if (_p.stairs[i].getTargetLevel() === level) {
                return _p.stairs[i];
            }
        }
    };

    //---------------------------------------------------------------------
    // STAIRS RELATED FUNCTIONS
    //---------------------------------------------------------------------

    /** Adds stairs for this level.*/
    this.addStairs = function(stairs, x, y) {
        stairs.setX(x);
        stairs.setY(y);
        if (stairs.getSrcLevel() !== this) stairs.setSrcLevel(this);
        _map.setProp(x, y, "elements", stairs);
        _p.elements.push(stairs);
        _p.stairs.push(stairs);
    };

    /** Uses stairs for given actor if it's on top of the stairs.*/
    this.useStairs = function(actor) {
        var cell = _map.getCell(actor.getX(), actor.getY());
        if (cell.hasPropType("stairs")) {
            var stairs = cell.getPropType("stairs")[0];
            if (stairs.useStairs(actor)) {
                return true;
            }
            else {
                RG.err("Level", "useStairs", "Failed to use the stairs.");
            }
        }
        return false;
    };

    //---------------------------------------------------------------------
    // ITEM RELATED FUNCTIONS
    //---------------------------------------------------------------------


    this.addItem = function(item, x, y) {
        if (!RG.isNullOrUndef([x, y])) {
            return this._addPropToLevelXY("items", item, x, y);
        }
        else {
            var freeCells = _map.getFree();
            if (freeCells.length > 0) {
                var xCell = freeCells[0].getX();
                var yCell = freeCells[0].getY();
                return this._addPropToLevelXY("items", item, xCell, yCell);
            }

        }
        return false;
    };

    this.removeItem = function(item, x, y) {
        return _map.removeProp(x, y, "items", item);
    };

    this.pickupItem = function(actor, x, y) {
        var cell = _map.getCell(x, y);
        if (cell.hasProp("items")) {
            var item = cell.getProp("items")[0];
            actor.getInvEq().addItem(item);
            cell.removeProp("items", item);
            RG.gameMsg(actor.getName() + " picked up an item!");
        }
        else {
            RG.gameMsg("Nothing to pickup!");
        }
    };

    //---------------------------------------------------------------------
    // ACTOR RELATED FUNCTIONS
    //---------------------------------------------------------------------

    /** Adds an actor to the level. If x,y is given, tries to add there. If not,
     * finds first free cells and adds there. Returns true on success.
     */
    this.addActor = function(actor, x, y) {
        RG.debug(this, "addActor called with x,y " + x + ", " + y);
        if (!RG.isNullOrUndef([x, y])) {
            if (_map.hasXY(x, y)) {
                this._addPropToLevelXY("actors", actor, x, y);
                RG.debug(this, "Added actor to map x: " + x + " y: " + y);
                return true;
            }
            else {
                RG.err("Level", "addActor", "No coordinates " + x + ", " + y + " in the map.");
                return false;
            }
        }
        else {
            RG.nullOrUndefError(this, "arg |x|", x);
            RG.nullOrUndefError(this, "arg |y|", y);
            return false;
        }
    };

    /** USing this method, actor can be added to a free cell without knowing the
     * exact x,y coordinates.*/
    this.addActorToFreeCell = function(actor) {
        RG.debug(this, "Adding actor to free slot");
        var freeCells = _map.getFree();
        if (freeCells.length > 0) {
            var xCell = freeCells[0].getX();
            var yCell = freeCells[0].getY();
            if (this._addPropToLevelXY("actors", actor, xCell, yCell)) {
                RG.debug(this, "Added actor to free cell in " + xCell + ", " + yCell);
                return true;
            }
        }
        else {
            RG.err("Level", "addActor", "No free cells for the actor.");
        }
        return false;
    };

    this._addPropToLevelXY = function(propType, obj, x, y) {
        if (_p.hasOwnProperty(propType)) {
            _p[propType].push(obj);
            if (obj.hasOwnProperty("setXY")) {
                obj.setXY(x,y);
                obj.setLevel(this);
            }
            _map.setProp(x, y, propType, obj);
            return true;
        }
        else {
            RG.err("Level", "_addPropToLevelXY", "No property " + propType);
        }
        return false;
    };

    /** Moves actor to x,y if possible and returns true. Returns false
     * otherwise.*/
    this.moveActorTo = function(actor, x, y) {
        var index = _p.actors.indexOf(actor);
        var cell = _map.getCell(x, y);
        RG.debug(this, "moveActorTo: Index is " + index);
        if (cell.isFree()) {
            if (index >= 0) {
                var xOld = actor.getX();
                var yOld = actor.getY();
                RG.debug(this, "Trying to move actor from " + xOld + ", " + yOld);

                if (_map.removeProp(xOld, yOld, "actors", actor)) {
                    _map.setProp(x, y, "actors", actor);
                    actor.setXY(x, y);
                    return true;
                }
                else {
                    RG.err("Level", "moveActorTo", "Couldn't remove actor.");
                }
            }
        }
        else {
            RG.debug(this, "Cell wasn't free at " + x + ", " + y);
        }
        return false;
    };

    /** Given actor attacks square x,y.*/
    this.attackWith = function(actor, x, y) {
        var cell = _map.getCell(x, y);
        if (cell.hasProp("actors")) {
            var target = cell.getProp("actors")[0];
            var combat = new RG.RogueCombat(actor, target);
            combat.fight();
            console.log("Actor attacks at " + x + ", " + y);
            return true;
        }
    };

    this.removeActor = function(actor) {
        var index = _p.actors.indexOf(actor);
        var x = actor.getX();
        var y = actor.getY();
        if (_map.removeProp(x, y, "actors", actor)) {
            _p.actors.splice(index, 1);
            return true;
        }
        else {
            return false;
        }
    };

    /** Explores the level from given actor's viewpoint. Sets new cells as
     * explored. There's no exploration tracking per actor.*/
    this.exploreCells = function(actor) {
        var visibleCells = _map.getVisibleCells(actor);
        if (actor.isPlayer()) {
            for (var i = 0; i < visibleCells.length; i++) {
                visibleCells[i].setExplored();
            }
        }
        return visibleCells;
    };

    /** Returns all explored cells in the map.*/
    this.getExploredCells = function() {
        return _map.getExploredCells();
    };

}; // }}} Level

/** Combatant object can be used for all actors and objects involved in
 * combat. */
RG.Combatant = function(hp) { // {{{2

    var _maxHP = hp;
    var _hp = hp;

    var _attack   = 10;
    var _defense  = 5;
    var _accuracy = 10;
    var _agility  = 5;

    var _range    = 1;
    var _exp      = 0;
    var _expLevel = 1;

    /** Hit points getters and setters.*/
    this.getHP = function() {return _hp;};
    this.setHP = function(hp) {_hp = hp;};
    this.getMaxHP = function() {return _maxHP;};
    this.setMaxHP = function(hp) {_maxHP = hp;};

    this.isAlive = function() {return _hp > 0;};
    this.isDead = function() {return _hp <= 0;};

    /** Attack methods. */
    this.getAttack = function() {return _attack;};
    this.setAttack = function(attack) { _attack = attack; };
    this.setAttackRange = function() {_range = range;};
    this.getAttackRange = function() {return _range; };

    /** These determine the chance of hitting. */
    this.setAccuracy = function(accu) {_accuracy = accu;};
    this.getAccuracy = function() {return _accuracy;};
    this.setAgility = function(agil) {_agility = agil;};
    this.getAgility = function() {return _agility;};

    /** Defense related methods.*/
    this.getDefense = function() { return _defense; };
    this.setDefense = function(defense) { _defense = defense; };

    /** Experience-level methods.*/
    this.setExp = function(exp) {_exp = exp;};
    this.getExp = function() {return _exp;};
    this.addExp = function(nExp) {_exp += nExp;};
    this.setExpLevel = function(expLevel) {_expLevel = expLevel;};
    this.getExpLevel = function() {return _expLevel;};

}; // }}} Combatant

/** Object representing a combat betweent two actors.  */
RG.RogueCombat = function(att, def) { // {{{2

    var _att = att;
    var _def = def;

    this.fight = function() {
        var attackPoints = _att.getAttack();
        var defPoints = _def.getDefense();
        var diff = attackPoints - defPoints;
        var accuracy = _att.getAccuracy();
        var agility = _def.getAgility();
        var total = accuracy + agility;
        var hitChange = accuracy / total;

        RG.gameMsg(_att.getName() + " attacks " + _def.getName() + ".");
        if (diff > 0) {
            if (hitChange > Math.random())
                this.doDamage(_def, diff);
            else
                RG.gameMsg(_att.getName() + " misses " + _def.getName() + ".");
        }
        else {
            RG.gameMsg(_att.getName() + " failed to damage " + _def.getName() + ".");
        }
    };

    this.doDamage = function(def, dmg) {
        def.setHP(def.getHP() - dmg);
        if (!def.isAlive()) {
            this.killActor(def);
        }
        else {
            RG.gameMsg(_def.getName() + " got " + dmg + " damage.");
        }
    };

    this.killActor = function(actor) {
        var level = actor.getLevel();
        if (level.removeActor(actor)) {
            this.giveExp(_att, _def.getExpLevel());
            RG.gameMsg(_def.getName() + " was killed.");
            RG.POOL.emitEvent(RG.EVT_ACTOR_KILLED, {actor: actor});
        }
        else {
            RG.err("Combat", "killActor", "Couldn't kill actor");
        }
    };

    /** Give some experience points.*/
    this.giveExp = function(att, defLevel) {
        att.addExp(defLevel);
        RG.checkExp(att);
    };

}; // }}} Combat

/** Models an item. Each item is ownable by someone. During game, there are no
 * items with null owners. Ownership shouldn't be ever set to null. */
RG.RogueItem = function(type) {
    RG.Ownable.call(this, null);
    this.setType("items");

    var _itemType = type;
    var _weight = 1;
    var _p = {}; // Stores all extra properties

    this.getItemType = function() {
        return _itemType;
    };

    this.hasProp = function(propName) {
        return _p.hasOwnProperty(propName);
    };

    this.getProp = function(propName) {
        if (_p.hasOwnProperty(propName)) {
            return _p[propName];
        }
        else {
            return null;
        }
    };

    this.setWeight = function(weight) {_weight = weight;};
    this.getWeight = function() {return weight;};



};
RG.extend2(RG.RogueItem, RG.Ownable);

/** Models an item container. Can hold a number of items.*/
RG.RogueItemContainer = function(owner) {
    RG.RogueItem.call(this, "container");
    this.setOwner(owner);

    var _items = [];
    var _iter  = 0;

    /** Adds an item. Container becomes item's owner.*/
    this.addItem = function(item) {
        if (item.getItemType() === "container") {
            if (this.getOwner() !== item) {
                item.setOwner(this);
                _items.push(item);
            }
            else {
                RG.err("Item", "addItem", "Added item is container's owner. Impossible.");
            }
        }
        else {
            item.setOwner(this);
            _items.push(item);
        }
    };

    this.getItems = function() {return _items;};

    this.hasItem = function(item) {
        var index = _items.indexOf(item);
        if (index !== -1) return true;
        return false;
    };

    this.removeItem = function(item) {
        var index = _items.indexOf(item);
        if (index !== -1) {
            _items.splice(index, 1);
            return true;
        }
        return false;
    };

    /** Returns first item or null for empty container.*/
    this.first = function() {
        if (_items.length > 0) {
            _iter = 1;
            return _items[0];
        }
        return null;
    };

    /** Returns next item from container or null if there are no more items.*/
    this.next = function() {
        if (_iter < _items.length) {
            return _items[_iter++];
        }
        return null;
    };

    /** Returns true for empty container.*/
    this.isEmpty = function() {
        return _items.length === 0;
    };

};
RG.extend2(RG.RogueItemContainer, RG.RogueItem);

/** Models one slot in the inventory. */
RG.RogueEquipSlot = function(eq, type, n) {
    RG.Ownable.call(this, eq);
    var _eq = eq;
    var _nitems = n;
    var _type = type;
    var _items = [];

    this.getItems = function() {
        return _items;
    };

    /** Equips given item to first available place in slot.*/
    this.equipItem = function(item) {
        if (this.canEquip(item)) {
            item.setOwner(this);
            _items.push(item);
            return true;
        }
        return false;
    };

    /** Unequips from given slot. */
    this.unequipItem = function(n) {
        if (n < _items.length) {
            _items.splice(n, 1);
            return true;
        }
        return false;
    };

    this.canEquip = function(item) {
        return _items.length < _nitems;
    };

};
RG.extend2(RG.RogueEquipSlot, RG.Ownable);

/** Models equipment on an actor.*/
RG.RogueEquipment = function(actor) {
    RG.Ownable.call(this, actor);

    var _equipped = [];

    var _slots = {
        hand: new RG.RogueEquipSlot(this, "hand", 2),
        head: new RG.RogueEquipSlot(this, "head", 1),
        chest: new RG.RogueEquipSlot(this, "chest", 1),
        neck: new RG.RogueEquipSlot(this, "neck", 1),
        feet: new RG.RogueEquipSlot(this, "feet", 1),
    };

    this.getItems = function(slot) {
        if (_slots.hasOwnProperty(slot)) {
            return _slots[slot].getItems();
        }
        return [];
    };

    this.equipItem = function(item) {
        // TODO add proper checks for equipping
        if (item.hasOwnProperty("equip")) {
            if (_slots[item.equip].equipItem(item)) {
                _equipped.push(item);
                return true;
            }
        }
        else { // No equip property, can only equip to hand
            if (_slots.hand.equipItem(item)) {
                _equipped.push(item);
                return true;
            }
        }
        return false;
    };

    this.isEquipped = function(item) {
        var index = _equipped.indexOf(item);
        console.log("Index is " + index);
        return index !== -1;
    };

    this.getEquipped = function(slotType) {
        return _slots[slotType].getItems();
    };

    /** Unequips given slotType and index. */
    this.unequipItem = function(slotType, n) {
        if (_slots.hasOwnProperty(slotType)) {
            var items = _slots[slotType].getItems();
                var item = items[n];
            if (_slots[slotType].unequipItem(n)) {
                var index = _equipped.indexOf(item);
                if (index >= 0) {
                    _equipped.splice(index, 1);
                    return true;
                }
                else {
                    RG.err("Equipment", "unequipItem", "Index < 0. Horribly wrong.");
                }
            }
        }
        else {
            var msg = "Non-existing slot type " + slotType;
            RG.err("Equipment", "unequipItem", msg);
        }
        return false;
    };

};
RG.extend2(RG.RogueEquipment, RG.Ownable);

/** Object models inventory items and equipment on actor. This object handles
 * movement of items between inventory and equipment. */
RG.RogueInvAndEquip = function(actor) {
    RG.Ownable.call(this, actor);
    var _actor = actor;

    var _inv = new RG.RogueItemContainer(actor);
    var _eq  = new RG.RogueEquipment(actor);

    // Wrappers for container methods
    this.addItem = function(item) {
        _inv.addItem(item);
    };

    this.getInventory = function() {return _inv;};
    this.getEquipment = function() {return _eq;};

    /** Removes item from inventory and equips it.*/
    this.equipItem = function(item) {
        if (_inv.hasItem(item)) {
            if (_eq.equipItem(item)) {
                return _inv.removeItem(item);
            }
        }
        else {
            RG.err("InvAndEquip", "equipItem", "Cannot equip. Not in inventory.");
        }
        return false;
    };

    /** Unequips item and puts it back to inventory.*/
    this.unequipItem = function(slotType, n) {
        var eqItems = _eq.getItems(slotType);
        if (n < eqItems.length) {
            var item = eqItems[n];
            if (_eq.unequipItem(slotType, n)) {
                this.addItem(item);
                return true;
            }
        }
        return false;
    };


};
RG.extend2(RG.RogueInvAndEquip, RG.Ownable);

/** Object representing a game actor who takes actions.  */
RG.RogueActor = function(name) { // {{{2
    RG.Locatable.call(this);
    RG.Combatant.call(this, RG.DEFAULT_HP);
    this.setType("actors");

    var _brain = new RG.RogueBrain(this);
    var _isPlayer = false;

    var _name = name;
    var _invEq = new RG.RogueInvAndEquip(this);

    this.id = RG.IdCount++;

    this.setName = function(name) {_name = name;};
    this.getName = function() {return _name;};

    this.setIsPlayer = function(isPlayer) {
        _isPlayer = isPlayer;
        if (isPlayer) {
            _brain = new RG.PlayerBrain(this);
        }
    };

    this.setBrain = function(brain) {
        _brain = brain;
        _brain.setActor(this);
    };

    /** Returns true if actor is a player.*/
    this.isPlayer = function() {
        return _isPlayer;
    };

    /** Returns the next action for this actor.*/
    this.nextAction = function(obj) {
        // Use actor brain to determine the action
        var cb = _brain.decideNextAction(obj);
        if (cb !== null) {
            return new RG.RogueAction(RG.ACTION_DUR, cb, {});
        }
        else {
            return new RG.RogueAction(0, function(){}, {});
        }
    };

    this.getFOVRange = function() {
        return RG.FOV_RANGE;
    };

    this.getName = function() {return _name;};
    this.setName = function(name) {_name = name;};

    this.getInvEq = function() {
        return _invEq;
    };

};
RG.extend2(RG.RogueActor, RG.Locatable);
RG.extend2(RG.RogueActor, RG.Combatant);
// }}} Actor

/** Element is a wall or other obstacle or a feature in the map. It's not
 * necessarily blocking movement.  */
RG.RogueElement = function(elemType) { // {{{2
    RG.Locatable.call(this);
    this.setType(elemType);

    var _elemType = elemType.toLowerCase();
    var _allowMove;
    switch(elemType) {
        case "wall": _allowMove = false; break;
        case "floor": _allowMove = true; break;
        default: _allowMove = true; break;
    }

    this.canMove = function() {
        return _allowMove;
    };

};
RG.extend2(RG.RogueElement, RG.Locatable);
// }}} Element

/** Object models stairs connecting two levels. Stairs are one-way, thus
 * connecting 2 levels requires two stair objects. */
RG.RogueStairsElement = function(down, srcLevel, targetLevel) {
    RG.RogueElement.call(this, "stairs");

    var _down = down;
    var _srcLevel = srcLevel;
    var _targetLevel = targetLevel;
    var _targetStairs = null;

    /** Target actor uses the stairs.*/
    this.useStairs = function(actor) {
        if (!RG.isNullOrUndef([_targetStairs, _targetLevel])) {
            var newLevel = _targetLevel;
            var newX = _targetStairs.getX();
            var newY = _targetStairs.getY();
            if (_srcLevel.removeActor(actor)) {
                if (_targetLevel.addActor(actor, newX, newY)) {
                    RG.POOL.emitEvent(RG.EVT_LEVEL_CHANGED, 
                        {target: _targetLevel, src: _srcLevel, actor: actor});
                    return true;
                }
            }
        }
        return false;
    };

    this.isDown = function() {return _down;};

    this.getSrcLevel = function() {return _srcLevel; };
    this.setSrcLevel = function(src) {_srcLevel = src;};

    this.getTargetLevel = function() {return _targetLevel; };
    this.setTargetLevel = function(target) {_targetLevel = target;};

    this.setTargetStairs = function(stairs) {_targetStairs = stairs;};
    this.getTargetStairs = function() {return _targetStairs;};

};
RG.extend2(RG.RogueStairsElement, RG.RogueElement);

/** Models an action. Each action has a duration and a callback.  */
RG.RogueAction = function(dur, cb, obj) { // {{{2

    var _duration = dur;
    var _cb = cb; // Action callback

    this.getDuration = function() {
        return _duration;
    };

    this.doAction = function() {
        _cb(obj);
    };

}; // }}} Action

//---------------------------------------------------------------------------
// BRAINS {{{1
//---------------------------------------------------------------------------

/** This brain is used by the player actor. It simply handles the player input
 * but by having brain, player actor looks like other actors.  */
RG.PlayerBrain = function(actor) { // {{{2

    var _actor = actor;

    var _guiCallbacks = {}; // For attaching GUI callbacks

    this.addGUICallback = function(code, callback) {
        _guiCallbacks[code] = callback;
    };

    this.decideNextAction = function(obj) {
        var code = obj.code;
        var level = _actor.getLevel();

        // Invoke GUI callback with given code
        if (_guiCallbacks.hasOwnProperty(code)) {
            _guiCallbacks[code](code);
            return null;
        }

        // Need existing position
        var x = _actor.getX();
        var y = _actor.getY();
        var xOld = x;
        var yOld = y;
        var currCell = level.getMap().getCell(x, y);

        var type = "NULL";
        if (code === ROT.VK_D) { ++x; type = "MOVE";}
        if (code === ROT.VK_A) { --x; type = "MOVE";}
        if (code === ROT.VK_W) { --y; type = "MOVE";}
        if (code === ROT.VK_X) { ++y; type = "MOVE";}
        if (code === ROT.VK_Q) {--y; --x; type = "MOVE";}
        if (code === ROT.VK_E) {--y; ++x; type = "MOVE";}
        if (code === ROT.VK_C) {++y; ++x; type = "MOVE";}
        if (code === ROT.VK_Z) {++y; --x; type = "MOVE";}
        if (code === ROT.VK_S) {
            // IDLE action
            type = "IDLE";
        }

        if (code === ROT.VK_PERIOD) {
            type = "PICKUP";
            return function() {
                level.pickupItem(_actor, x, y);
            };
        }

        if (code === ROT.VK_SPACE) {
            type = "STAIRS";
            if (currCell.hasPropType("stairs")) {
                return function() {level.useStairs(_actor);};
            }
            else {
                return null;
            }
        }

        if (type === "MOVE") {
            if (level.getMap().isPassable(x, y)) {
                return function() {
                    level.moveActorTo(_actor, x, y);
                };
            }
            else if (level.getMap().getCell(x,y).hasProp("actors")) {
                return function() {
                    level.attackWith(_actor, x, y);
                };
            }
        }
        else if (type === "IDLE") {
            return function() {};
        }

        return null; // Null action
    };

}; // }}} PlayerBrain


/** Brain is used by the AI to perform and decide on actions. Brain returns
 * actionable callbacks but doesn't know Action objects.  */
RG.RogueBrain = function(actor) { // {{{2

    var _actor = actor;
    var _explored = {};

    this.setActor = function(actor) {_actor = actor;};
    this.getActor = function() {return _actor;};

    var passableCallback = function(x, y) {
        var map = _actor.getLevel().getMap();
        if (!RG.isNullOrUndef([map])) {
            var res = map.isPassable(x, y);
            if (!res) {
                res = (x === _actor.getX()) && (y === _actor.getY());
            }
            return res;
        }
        else {
            RG.err("Brain", "passableCallback", "_map not well defined.");
        }
        return false;
    };

    /** Main function for retrieving the actionable callback. Acting actor must
     * be passed in. */
    this.decideNextAction = function(obj) {
        var level = _actor.getLevel();
        var seenCells = level.getMap().getVisibleCells(_actor);
        //var seenCells = level.getMap().getVisibleForAI(_actor);
        var playerCell = this.findPlayerCell(seenCells);

        if (!RG.isNullOrUndef([playerCell])) { // Move or attack
            var playX = playerCell.getX();
            var playY = playerCell.getY();
            if (this.canAttack(playX, playY)) {
                return function() {
                    level.attackWith(_actor, playX, playY);
                };
            }
            else { // Move closer
                var pathCells = this.getShortestPathTo(playerCell);
                if (pathCells.length > 1) {
                    var pathX = pathCells[1].getX();
                    var pathY = pathCells[1].getY();
                    return function() {
                        level.moveActorTo(_actor, pathX, pathY);
                    };
                }
                else { // Cannot move anywhere
                    return function() {};
                }
            }
        }

        //console.log("Actor " + _actor.getName() + " exploring.");

        var index = -1;
        for (var i = 0, ll = seenCells.length; i < ll; i++) {
            if (seenCells[i].isFree()) {
                var xy = seenCells[i].getX() + "," + seenCells[i].getY();
                if (!_explored.hasOwnProperty(xy)) {
                    _explored[xy] = true;
                    index = i;
                    break;
                }
            }
        }

        if (index === -1) { // Choose random cell
            index = Math.floor(Math.random() * (seenCells.length));
        }
        return function() {
            var x = seenCells[index].getX();
            var y = seenCells[index].getY();
            level.moveActorTo(_actor, x, y);
        };

    };

    this.canAttack = function(x, y) {
        var actorX = _actor.getX();
        var actorY = _actor.getY();
        var attackRange = _actor.getAttackRange();
        var getDist = RG.shortestDist(x, y, actorX, actorY);
        if (getDist <= attackRange) return true;
        return false;
    };

    /** Given a list of cells, returns a cell with player in it or null.*/
    this.findPlayerCell = function(cells) {
        for (var i = 0, iMax=cells.length; i < iMax; i++) {
            if (cells[i].hasProp("actors")) {
                var actors = cells[i].getProp("actors");
                if (actors[0].isPlayer()) return cells[i];
            }
        }
        return null;
    };

    /** Returns shortest path from actor to the given cell. Resulting cells are
     * returned in order: closest to the actor first. Thus moving to next cell
     * can be done by taking the first returned cell.*/
    this.getShortestPathTo = function(cell) {
        var path = [];
        var toX = cell.getX();
        var toY = cell.getY();
        var pathFinder = new ROT.Path.Dijkstra(toX, toY, passableCallback);
        var map = _actor.getLevel().getMap();
        var sourceX = _actor.getX();
        var sourceY = _actor.getY();

        if (RG.isNullOrUndef([toX, toY, sourceX, sourceY])) {
            RG.err("Brain", "getShortestPathTo", "Null/undef coords.");
        }

        pathFinder.compute(sourceX, sourceY, function(x, y) {
            if (map.hasXY(x, y)) {
                path.push(map.getCell(x, y));
            }
        });
        return path;
    };

}; // }}} RogueBrain

RG.ZombieBrain = function() {
    RG.RogueBrain.call(this);

};
RG.extend2(RG.ZombieBrain, RG.RogueBrain);


// }}} BRAINS
//

/** Event is something that is scheduled and takes place but it's not an actor.
 * An example is regeneration or poison effect.*/
RG.RogueEvent = function(dur, cb) {

    var _cb = cb;

    this.isEvent = true;
    this.isPlayer = function(){return false;};

    this.nextAction = function() {
        return new RG.RogueAction(dur, cb, {});
    };

};

/** Regeneration event.*/
RG.RogueRegenEvent = function(actor, dur) {

    var _regenerate = function() {
        var maxHP = actor.getMaxHP();
        var hp = actor.getHP();
        hp += 1;
        if (hp <= maxHP) {
            actor.setHP(hp);
            RG.gameMsg(actor.getName() + " regenerates 1 HP.");
        }
    };

    RG.RogueEvent.call(this, 20 * RG.ACTION_DUR, _regenerate);
};
RG.extend2(RG.RogueEvent, RG.RogueRegenEvent);

/** Scheduler for the game actions.  */
RG.RogueScheduler = function() { // {{{2

    // Internally use ROT scheduler
    var _scheduler = new ROT.Scheduler.Action();

    this.add = function(actor, repeat, offset) {
        _scheduler.add(actor, repeat, offset);
    };

    // Returns null if no next actor exists.
    this.next = function() {
        return _scheduler.next();
    };

    this.setAction = function(action) {
        _scheduler.setDuration(action.getDuration());
    };

    /** Tries to remove an actor, Return true if success.*/
    this.remove = function(actor) {
        return _scheduler.remove(actor);
    };

    this.getTime = function() {
        return _scheduler.getTime();
    };

    /** Hooks to the event system. When actor is killed, removes it from the
     * scheduler.*/
    this.notify = function(evtName, args) {
        if (evtName === RG.EVT_ACTOR_KILLED) {
            if (args.hasOwnProperty("actor")) {
                this.remove(args.actor);
            }
        }
    };
    RG.POOL.listenEvent(RG.EVT_ACTOR_KILLED, this);


}; // }}} Scheduler


//---------------------------------------------------------------------------
// MAP GENERATION SECTION {{{1
//---------------------------------------------------------------------------

/** Map generator for the roguelike game.  */
RG.RogueMapGen = function() { // {{{2

    this.cols = 50;
    this.rows = 30;
    var _mapGen = new ROT.Map.Arena(50, 30);

    var _types = ["arena", "cellular", "digger", "divided", "dungeon",
        "eller", "icey", "uniform", "rogue"];

    this.getRandType = function() {
        var len = _types.length;
        var nRand = Math.floor(Math.random() * len);
        return _types[nrand];
    };

    this.setGen = function(type, cols, rows) {
        this.cols = cols;
        this.rows = rows;
        type = type.toLowerCase();
        switch(type) {
            case "arena":  _mapGen = new ROT.Map.Arena(cols, rows); break;
            case "cellular":  _mapGen = new ROT.Map.Cellular(cols, rows); break;
            case "digger":  _mapGen = new ROT.Map.Digger(cols, rows); break;
            case "divided":  _mapGen = new ROT.Map.DividedMaze(cols, rows); break;
            case "dungeon":  _mapGen = new ROT.Map.Dungeon(cols, rows); break;
            case "eller":  _mapGen = new ROT.Map.EllerMaze(cols, rows); break;
            case "icey":  _mapGen = new ROT.Map.IceyMaze(cols, rows); break;
            case "rogue":  _mapGen = new ROT.Map.Rogue(cols, rows); break;
            case "uniform":  _mapGen = new ROT.Map.Uniform(cols, rows); break;
            default: RG.err("MapGen", "setGen", "_mapGen type " + type + " is unknown");
        }
    };

    /** Returns a randomized map based on initialized generator settings.*/
    this.getMap = function() {
        var map = new RG.Map(this.cols, this.rows);
        _mapGen.create(function(x, y, val) {
            if (val > 0) {
                map.setBaseElemXY(x, y, new RG.RogueElement("wall"));
            }
            else {
                map.setBaseElemXY(x, y, new RG.RogueElement("floor"));
            }
        });
        return map;
    };

}; // }}} RogueMapGen

/** Object representing one game cell. It can hold actors, items, traps or
 * elements. */
RG.MapCell = function(x, y, elem) { // {{{2 

    var _baseElem = elem;
    var _x   = x;
    var _y   = y;
    var _explored = false;

    // Cell can have different properties
    var _p = {
        items: [],
        actors   : [],
        elements : [],
        traps    : [],
    };

    this.getX = function() {return _x;};
    this.getY = function() {return _y;};

    /** Sets/gets the base element for this cell. There can be only one element.*/
    this.setBaseElem = function(elem) { _baseElem = elem; };
    this.getBaseElem = function() { return _baseElem; };

    /** Returns true if it's possible to move to this cell.*/
    this.isFree = function() {
        return _baseElem.getType() !== "wall" &&
            !this.hasProp("actors");
    };

    /** Add given obj has specified property.*/
    this.setProp = function(prop, obj) {
        if (_p.hasOwnProperty(prop)) {
            _p[prop].push(obj);
            if (obj.hasOwnProperty("setOwner")) {
                obj.setOwner(this);
            }
        }
        else {
            RG.err("MapCell", "setProp", "No property " + prop);
        }
    };

    /** Removes the given object from cell properties.*/
    this.removeProp = function(prop, obj) {
        if (this.hasProp(prop)) {
            var props = _p[prop];
            var index = props.indexOf(obj);
            if (index === -1) return false;
            _p[prop].splice(index, 1);
            return true;
        }
        return false;
    };

    this.hasProp = function(prop) {
        if (_p.hasOwnProperty(prop)) {
            return _p[prop].length > 0;
        }
        return false;
    };

    /** Returns true if any cell property has the given type. Ie.
     * myCell.hasPropType("wall"). Doesn't check for basic props like "actors",
     * "items" etc.
     */
    this.hasPropType = function(propType) {
        if (_baseElem.getType() === propType) return true;
        for (var prop in _p) {
            var arrProps = _p[prop];
            for (var i = 0; i < arrProps.length; i++) {
                if (arrProps[i].getType() === propType) {
                    return true;
                }
            }
        }
        return false;
    };

    /** Returns all props with given type in the cell.*/
    this.getPropType = function(propType) {
        var props = [];
        if (_baseElem.getType() === propType) return [_baseElem];
        for (var prop in _p) {
            var arrProps = _p[prop];
            for (var i = 0; i < arrProps.length; i++) {
                if (arrProps[i].getType() === propType) {
                    props.push(arrProps[i]);
                }
            }
        }
        return props;
    };

    this.getProp = function(prop) {
        if (_p.hasOwnProperty(prop)) {
            return _p[prop];
        }
        return null;
    };

    this.lightPasses = function() {
        if (_baseElem.getType() === "wall") return false;
        return true;
    };

    this.isPassable = function() {
        return this.isFree();
    };

    this.setExplored = function() {
        _explored = true;
    };

    this.isExplored = function() {
        return _explored;
    };

    /** Returns string representation of the cell.*/
    this.toString = function() {
        var str = "MapCell " + _x + ", " + _y;
        str += " explored: " + _explored;
        str += " passes light: " + this.lightPasses();
        for (var prop in _p) {
            var arrProps = _p[prop];
            for (var i = 0; i < arrProps.length; i++) {
                if (arrProps[i].hasOwnProperty("toString")) {
                    str += arrProps[i].toString();
                }
            }
        }
        return str;
    };

}; // }}} MapCell

/** Map object which contains a number of cells. A map is used for rendering
 * while the level contains actual information about game elements such as
 * monsters and items.  */
RG.Map = function(cols, rows) { //{{{2
    var map = [];
    this.cols = cols;
    this.rows = rows;

    var _cols = cols;
    var _rows = rows;

    for (var x = 0; x < this.cols; x++) {
        map.push([]);
        for (var y = 0; y < this.rows; y++) {
            var elem = new RG.RogueElement("floor");
            map[x].push(new RG.MapCell(x, y, elem));
        }
    }

    /** Returns true if x,y are in the map.*/
    this.hasXY = function(x, y) {
        return (x >= 0) && (x < this.cols) && (y >= 0) && (y < this.rows);
    };

    /** Sets a property for the underlying cell.*/
    this.setProp = function(x, y, prop, obj) {
        map[x][y].setProp(prop, obj);
    };

    this.removeProp = function(x, y, prop, obj) {
        return map[x][y].removeProp(prop, obj);
    };

    this.setBaseElemXY = function(x, y, elem) {
        map[x][y].setBaseElem(elem);
    };

    this.getBaseElemXY = function(x, y) {
        return map[x][y].getBaseElem();
    };

    this.getCell = function(x, y) {
        return map[x][y];
    };

    this.getBaseElemRow = function(y) {
        var row = [];
        for (var i = 0; i < this.cols; ++i) {
            row.push(map[i][y].getBaseElem());
        }
        return row;
    };

    this.getCellRow = function(y) {
        var row = [];
        for (var i = 0; i < this.cols; ++i) {
            row.push(map[i][y]);
        }
        return row;
    };

    /** Returns all free cells in the map.*/
    this.getFree = function() {
        var freeCells = [];
        for (var x = 0; x < this.cols; x++) {
            for (var y = 0; y < this.rows; y++) {
                if (map[x][y].isFree()) {
                    freeCells.push(map[x][y]);
                }
            }
        }
        return freeCells;
    };

    /** Returns true if the map has a cell in given x,y location.*/
    var _hasXY = function(x, y) {
        return (x >= 0) && (x < _cols) && (y >= 0) && (y < _rows);
    };

    /** Returns true if light passes through this cell.*/
    var lightPasses = function(x, y) {
        if (_hasXY(x, y)) {
            return map[x][y].lightPasses(); // delegate to cell
        }
        return false;
    };

    this.isPassable = function(x, y) {
        if (_hasXY(x, y)) {
            return map[x][y].isPassable();
        }
        return false;
    };

    var fov = new ROT.FOV.PreciseShadowcasting(lightPasses);

    /** Returns visible cells for given actor.*/
    this.getVisibleCells = function(actor) {
        var cells = [];
        var xActor = actor.getX();
        var yActor = actor.getY();
        if (actor.isLocated()) {
            if (actor.getLevel().getMap() === this) {
                var range = actor.getFOVRange();
                fov.compute(xActor, yActor, range, function(x, y, r, visibility) {
                    //console.log(x + "," + y + " r: " + r + "vis: " + visibility);
                    if (visibility) {
                        if (_hasXY(x, y)) {
                            //console.log(map[x][y].toString());
                            cells.push(map[x][y]);
                        }
                    }
                });
            }
        }
        return cells;
    };

    this.getVisibleForAI = function(actor) {
        var xActor = actor.getX();
        var yActor = actor.getY();
        var range = actor.getFOVRange();
        var cells = [];
        for (var x = xActor-5; x <= xActor+5; x++) {
            for (var y = yActor-5; y <= yActor+5; y++) {
                if (_hasXY(x, y)) cells.push(map[x][y]);
            }
        }
        return cells;
    };

    this.getExploredCells = function() {
        var cells = [];
        for (var x = 0; x < this.cols; x++) {
            for (var y = 0; y < this.rows; y++) {
                if (map[x][y].isExplored()) {
                    cells.push(map[x][y]);
                }
            }
        }
    };

}; // }}} Map

// }}} MAP GENERATION

/** Factory object for creating some commonly used objects.*/
RG.Factory = function() {

    var _initCombatant = function(comb, hp, att, def) {
        if (!RG.isNullOrUndef([hp])) comb.setHP(hp);
        if (!RG.isNullOrUndef([att])) comb.setAttack(att);
        if (!RG.isNullOrUndef([def])) comb.setAttack(def);
    };

    /** Factory method for players.*/
    this.createPlayer = function(name, hp, att, def) {
        var player = new RG.RogueActor(name);
        player.setIsPlayer(true);
        _initCombatant(player, hp, att, def);
        return player;
    };

    /** Factory method for monsters.*/
    this.createMonster = function(name, hp, att, def, brain) {
        var monster = new RG.RogueActor(name);
        _initCombatant(monster, hp, att, def);
        if (!RG.isNullOrUndef([brain])) {
            if (typeof brain === "object") {
                monster.setBrain(brain);
            }
            else {
                var newBrain = this.createBrain(brain);
                monster.setBrain(newBrain);
            }
        }
        return monster;
    };

    this.createBrain = function(brainName) {
        switch(brainName) {
            case "Zombie": return new RG.ZombieBrain(null);
            default: return new RG.RogueBrain(null);
        }
    };

    this.createFloorCell = function(x, y) {
        var cell = new RG.MapCell(x, y, new RG.RogueElement("floor"));
        return cell;
    };

    this.createWallCell = function(x, y) {
        var cell = new RG.MapCell(x, y, new RG.RogueElement("wall"));
        return cell;
    };

    /** Factory method for creating levels.*/
    this.createLevel = function(levelType, cols, rows) {
        var mapgen = new RG.RogueMapGen();
        mapgen.setGen(levelType, cols, rows);
        var level = new RG.RogueLevel(cols, rows);
        var map = mapgen.getMap();
        level.setMap(map);
        return level;
    };

    /** Creates a randomized level for the game. Danger level controls how the
     * randomization is done. */
    this.createRandLevel = function(cols, rows, danger) {
        var levelType = RG.RogueMapGen.getRandType();
        var level = this.createLevel(levelType, cols, rows);

    };

    this.createWorld = function(nlevels) {

    };

    this.createGame = function(obj) {
        var cols = obj.cols;
        var rows = obj.rows;
        var nLevels = obj.levels;
        var monstersPerLevel = obj.monsters;

        var game = new RG.RogueGame();

        var player = this.createPlayer("Player");
        player.setType("player");

        var regenPlayer = new RG.RogueRegenEvent(player);
        game.addEvent(regenPlayer);

        //var levels = ["dungeon", "digger", "icey"];
        var levels = ["digger"];
        var maxLevelType = levels.length;

        var allStairsUp   = [];
        var allStairsDown = [];
        var allLevels     = [];

        // This loop creates level per iteration
        for (var nl = 0; nl < nLevels; nl++) {

            var nLevelType = Math.floor(Math.random() * maxLevelType);
            var level = this.createLevel(levels[nLevelType], cols, rows);
            game.addLevel(level);
            if (nl === 0) game.addPlayer(player);

            var item = new RG.RogueItem("food");
            var weapon = new RG.RogueItem("weapon");
            level.addItem(item);
            level.addItem(weapon);

            for (var i = 0; i < monstersPerLevel; i++) {
                var cell = this.getFreeRandCell(level);
                var id = "CritterL" + nl + "," + i;
                var hp = 10 + nl * 5;
                var monster = this.createMonster(id, hp);
                monster.setType("monster");
                monster.setExpLevel(nl + 1);
                level.addActor(monster, cell.getX(), cell.getY());
                game.addActor(monster);
            }

            allLevels.push(level);
        }

        // Connect levels with stairs
        for (nl = 0; nl < nLevels; nl++) {
            var src = allLevels[nl];

            var stairCell = null;
            if (nl < nLevels-1) {
                var targetDown = allLevels[nl+1];
                var stairsDown = new RG.RogueStairsElement(true, src, targetDown);
                stairCell = this.getFreeRandCell(src);
                src.addStairs(stairsDown, stairCell.getX(), stairCell.getY());
                allStairsDown.push(stairsDown);
            }
            else {
                allStairsDown.push(null);
            }

            if (nl > 0) {
                var targetUp = allLevels[nl-1];
                var stairsUp = new RG.RogueStairsElement(false, src, targetUp);
                stairCell = this.getFreeRandCell(src);
                src.addStairs(stairsUp, stairCell.getX(), stairCell.getY());
                allStairsUp.push(stairsUp);
            }
            else {
                allStairsUp.push(null);
            }
        }

        // Finally connect the stairs together
        for (nl = 0; nl < nLevels; nl++) {
            if (nl < nLevels-1)
                allStairsDown[nl].setTargetStairs(allStairsUp[nl+1]);
            if (nl > 0)
                allStairsUp[nl].setTargetStairs(allStairsDown[nl-1]);
        }

        return game;

    };

    /** Return random free cell on a given level.*/
    this.getFreeRandCell = function(level) {
        var freeCells = level.getMap().getFree();
        if (freeCells.length > 0) {
            var maxFree = freeCells.length;
            var randCell = Math.floor(Math.random() * maxFree);
            var cell = freeCells[randCell];
            return cell;
        }
        return null;
    };

};

RG.FACT = new RG.Factory();


if ( typeof exports !== 'undefined' ) {
    if( typeof RG !== 'undefined' && module.exports ) {
        exports = module.exports = RG;
    }
    exports.RG = RG;
}
else {
    window.RG = RG;
}

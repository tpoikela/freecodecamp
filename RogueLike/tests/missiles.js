

var chai = require("chai");
var expect = chai.expect;
var RG = require("../roguelike.js");

var Actor = RG.RogueActor;
var Level = RG.RogueLevel;

var updateSystems = function(systems) {
    for (var i = 0; i < systems.length; i++) {
        systems[i].update();
    }
};

describe('How missile is fired and hits a wall', function() {


    var mSystem = new RG.MissileSystem("Missile", ["Missile"]);
    var dSystem = new RG.DamageSystem("Damage", ["Damage"]);

    var systems = [mSystem, dSystem];

    it('Starts from source and flies to target', function() {
        var level = RG.FACT.createLevel("arena", 30, 30);
        // Archer to fire the missiles
        var srcEnt = new Actor("archer");

        level.addActor(srcEnt, 1, 1);

        var mEnt = new RG.Entity();
        var mComp = new RG.MissileComponent(srcEnt);
        mEnt.add("Missile", mComp);

        expect(mComp.getX()).to.equal(1);
        expect(mComp.getY()).to.equal(1);
        mComp.setTargetXY(1, 4);

        updateSystems(systems);
        expect(mComp.getX()).to.equal(1);
        expect(mComp.getY()).to.equal(4);
        expect(mComp.inTarget()).to.equal(true);
        expect(mComp.isFlying()).to.equal(false);

        //level.addActor(targetEnt, 1, 4);
    });

    it('Stops and hits a wall', function() {
        var level = RG.FACT.createLevel("arena", 30, 30);
        // Archer to fire the missiles
        var srcEnt = new Actor("archer");
        level.addActor(srcEnt, 1, 1);

        var wall = new RG.RogueElement("wall");
        var map = level.getMap();
        var cell = map.getCell(1, 3);
        cell.setProp("elements", wall);

        var mEnt = new RG.Entity();
        var mComp = new RG.MissileComponent(srcEnt);
        mEnt.add("Missile", mComp);
        mComp.setTargetXY(1, 4);

        updateSystems(systems);
        expect(mComp.getX()).to.equal(1);
        expect(mComp.getY()).to.equal(2);
        expect(mComp.inTarget()).to.equal(false);
        expect(mComp.isFlying()).to.equal(false);

    });

    it('Stops and hits an entity (actor)', function() {
        var level = RG.FACT.createLevel("arena", 30, 30);
        // Archer to fire the missiles
        var srcEnt = new Actor("archer");
        level.addActor(srcEnt, 1, 1);
        var targetEnt = new Actor("prey");
        targetEnt.get("Combat").setDefense(0);
        level.addActor(targetEnt, 1, 6);

        var mEnt = new RG.Entity();
        var mComp = new RG.MissileComponent(srcEnt);
        mComp.setAttack(1);
        mComp.setDamage(5);
        mEnt.add("Missile", mComp);
        mComp.setTargetXY(1, 6);

        updateSystems(systems);
        expect(mComp.getX()).to.equal(1);
        expect(mComp.getY()).to.equal(6);
        expect(mComp.inTarget()).to.equal(true);
        expect(mComp.isFlying()).to.equal(false);

        expect(targetEnt.has("Damage")).to.equal(false);

    });
});

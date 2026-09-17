let data = {"heroes":[
 {"className":"hero.0.name","weapon":0,"img":"./images/UI/doll/rogue.png","anims":[
    {"move":[
        {"speed":8,"times":4,"w":128,"h":51,"img":"./images/hero/rogue/move/back.png"},
        {"speed":8,"times":4,"w":128,"h":51,"img":"./images/hero/rogue/move/front.png"},
        {"speed":8,"times":4,"w":128,"h":51,"img":"./images/hero/rogue/move/left.png"},
        {"speed":8,"times":4,"w":128,"h":51,"img":"./images/hero/rogue/move/right.png"}
    ]},
    {"attack":[
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/rogue/attack/back.png","once":1,"new":{"step":3,"anim":[0,0]}},
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/rogue/attack/front.png","once":1,"new":{"step":3,"anim":[0,1]}},
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/rogue/attack/left.png","once":1,"new":{"step":3,"anim":[0,2]}},
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/rogue/attack/right.png","once":1,"new":{"step":3,"anim":[0,3]}}
    ]},
    {"others":[
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/rogue/others/damage.png","once":1,"stun":1},
        {"speed":5,"times":4,"w":128,"h":51,"img":"./images/hero/rogue/others/death.png","once":1},
        {"speed":5,"times":4,"w":128,"h":51,"img":"./images/hero/rogue/others/wait.png","once":1}
    ]}
],"stats":[
    {"name":"stat.0.0","value":3,"dops":[{"name":"dop.0.0.0","desc":"","value1":0,"value2":0},{"name":"dop.0.0.1","desc":"","value1":0,"value2":0},{"name":"dop.0.0.2","desc":"","value1":0,"value2":0}]},
    {"name":"stat.0.1","value":7,"dops":[{"name":"dop.0.1.0","desc":"","value1":0,"value2":0},{"name":"dop.0.1.1","desc":"","value1":0,"value2":0},{"name":"dop.0.1.2","desc":"","value1":0,"value2":0}]},
    {"name":"stat.0.2","value":3,"dops":[{"name":"dop.0.2.0","desc":"","value1":0,"value2":0},{"name":"dop.0.2.1","desc":"","value1":0,"value2":0},{"name":"dop.0.2.2","desc":"","value1":0,"value2":0}]},
    {"name":"stat.0.3","value":5,"dops":[{"name":"dop.0.3.0","desc":"","value1":0,"value2":0},{"name":"dop.0.3.1","desc":"","value1":0,"value2":0},{"name":"dop.0.3.2","desc":"","value1":0,"value2":0}]},
    {"name":"stat.0.4","value":2,"dops":[{"name":"dop.0.4.0","desc":"","value1":0,"value2":0},{"name":"dop.0.4.1","desc":"","value1":0,"value2":0},{"name":"dop.0.4.2","desc":"","value1":0,"value2":0}]}
],
"skills":[
    {"title":"skill.0.0.title","descFull":"skill.0.0.desc","descFullL2":"skill.0.0.desc2","descFullL3":"skill.0.0.desc3","prev":0,"next":[2,3],"x":1,"y":0,"img":"./images/hero/rogue/abil/13.png"},
    {"title":"skill.0.1.title","descFull":"skill.0.1.desc","duration":900,"cooldown":900,"prev":0,"next":[4,5],"x":4,"y":0,"img":"./images/hero/rogue/abil/7.png"},
    {"title":"skill.0.2.title","descFull":"skill.0.2.desc","duration":120,"cooldown":600,"prev":[0],"next":[6,7],"x":0,"y":1,"img":"./images/hero/rogue/abil/10.png"},
    {"title":"skill.0.3.title","descFull":"skill.0.3.desc","descFullL2":"skill.0.3.desc2","descFullL3":"skill.0.3.desc3","prev":[0],"next":[8,9],"x":2,"y":1,"img":"./images/hero/rogue/abil/5.png"},
    {"title":"skill.0.4.title","descFull":"skill.0.4.desc","prev":[1],"next":[9],"x":4,"y":1,"img":"./images/hero/rogue/abil/4.png"},
    {"title":"skill.0.5.title","descFull":"skill.0.5.desc","descFullL2":"skill.0.5.desc2","duration":90,"cooldown":720,"prev":[1],"next":[13],"x":5,"y":1,"img":"./images/hero/rogue/abil/11.png"},
    {"title":"skill.0.6.title","descFull":"skill.0.6.desc","cooldown":10,"prev":[2],"next":[10],"x":0,"y":2,"img":"./images/hero/rogue/abil/2.png"},
    {"title":"skill.0.7.title","descFull":"skill.0.7.desc","descFullL2":"skill.0.7.desc2","prev":[2],"next":0,"x":1,"y":2,"img":"./images/hero/rogue/abil/6.png"},
    {"title":"skill.0.8.title","descFull":"skill.0.8.desc","prev":[3],"next":0,"x":2,"y":2,"img":"./images/hero/rogue/abil/1.png"},
    {"title":"skill.0.9.title","descFull":"skill.0.9.desc","descFullL2":"skill.0.9.desc2","prev":[3,4],"next":[11,12],"x":3,"y":2,"img":"./images/hero/rogue/abil/8.png"},
    {"title":"skill.0.10.title","descFull":"skill.0.10.desc","prev":[6],"next":0,"x":0,"y":3,"img":"./images/hero/rogue/abil/9.png"},
    {"title":"skill.0.11.title","descFull":"skill.0.11.desc","cooldown":300,"prev":[9],"next":0,"x":3,"y":3,"img":"./images/hero/rogue/abil/12.png"},
    {"title":"skill.0.12.title","descFull":"skill.0.12.desc","prev":[9],"next":0,"x":4,"y":3,"img":"./images/hero/rogue/abil/3.png"},
    {"title":"skill.0.13.title","descFull":"skill.0.13.desc","cooldown":1500,"prev":[5],"next":0,"x":5,"y":2,"img":"./images/hero/rogue/abil/14.png"},
],
},
{"className":"hero.1.name","weapon":3,"img":"./images/UI/doll/sorceress.png","anims":[
    {"move":[
        {"speed":8,"times":4,"w":128,"h":51,"img":"./images/hero/sorca/move/back.png"},
        {"speed":8,"times":4,"w":128,"h":51,"img":"./images/hero/sorca/move/front.png"},
        {"speed":8,"times":4,"w":128,"h":51,"img":"./images/hero/sorca/move/left.png"},
        {"speed":8,"times":4,"w":128,"h":51,"img":"./images/hero/sorca/move/right.png"}
    ]},
    {"attack":[
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/sorca/attack/back.png","once":1,"new":{"step":3,"anim":[0,0]}},
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/sorca/attack/front.png","once":1,"new":{"step":3,"anim":[0,1]}},
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/sorca/attack/left.png","once":1,"new":{"step":3,"anim":[0,2]}},
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/sorca/attack/right.png","once":1,"new":{"step":3,"anim":[0,3]}}
    ]},
    {"others":[
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/sorca/others/damage.png","once":1,"stun":1},
        {"speed":5,"times":4,"w":128,"h":51,"img":"./images/hero/sorca/others/death.png","once":1},
        {"speed":5,"times":4,"w":128,"h":51,"img":"./images/hero/sorca/others/wait.png","once":1}
    ]}
],"stats":[
    {"name":"stat.1.0","value":2,"dops":[{"name":"dop.1.0.0","desc":"","value1":0,"value2":0},{"name":"dop.1.0.1","desc":"","value1":0,"value2":0},{"name":"dop.1.0.2","desc":"","value1":0,"value2":0}]},
    {"name":"stat.1.1","value":3,"dops":[{"name":"dop.1.1.0","desc":"","value1":0,"value2":0},{"name":"dop.1.1.1","desc":"","value1":0,"value2":0},{"name":"dop.1.1.2","desc":"","value1":0,"value2":0}]},
    {"name":"stat.1.2","value":3,"dops":[{"name":"dop.1.2.0","desc":"","value1":0,"value2":0},{"name":"dop.1.2.1","desc":"","value1":0,"value2":0},{"name":"dop.1.2.2","desc":"","value1":0,"value2":0}]},
    {"name":"stat.1.3","value":3,"dops":[{"name":"dop.1.3.0","desc":"","value1":0,"value2":0},{"name":"dop.1.3.1","desc":"","value1":0,"value2":0},{"name":"dop.1.3.2","desc":"","value1":0,"value2":0}]},
    {"name":"stat.1.4","value":9,"dops":[{"name":"dop.1.4.0","desc":"","value1":0,"value2":0},{"name":"dop.1.4.1","desc":"","value1":0,"value2":0},{"name":"dop.1.4.2","desc":"","value1":0,"value2":0}]}
],
"skills":[
    {"title":"skill.1.0.title","descFull":"skill.1.0.desc","descFullL2":"skill.1.0.desc2","descFullL3":"skill.1.0.desc3","damage":2,"cooldown":300,"prev":0,"next":[3,4],"x":0,"y":0,"img":"./images/hero/sorca/abil/13.png"},
    {"title":"skill.1.1.title","descFull":"skill.1.1.desc","descFullL2":"skill.1.1.desc2","damage":1,"duration":60,"cooldown":720,"prev":0,"next":[4,5],"x":2,"y":0,"img":"./images/hero/sorca/abil/7.png"},
    {"title":"skill.1.2.title","descFull":"skill.1.2.desc","damage":1,"duration":60,"cooldown":600,"prev":0,"next":[6,7],"x":5,"y":0,"img":"./images/hero/sorca/abil/10.png"},
    {"title":"skill.1.3.title","descFull":"skill.1.3.desc","prev":[0],"next":0,"x":0,"y":1,"img":"./images/hero/sorca/abil/5.png"},
    {"title":"skill.1.4.title","descFull":"skill.1.4.desc","prev":[0,1],"next":[8],"x":1,"y":1,"img":"./images/hero/sorca/abil/4.png"},
    {"title":"skill.1.5.title","descFull":"skill.1.5.desc","descFullL2":"skill.1.5.desc2","descFullL3":"skill.1.5.desc3","duration":90,"cooldown":720,"prev":[1],"next":[9],"x":2,"y":1,"img":"./images/hero/sorca/abil/11.png"},
    {"title":"skill.1.6.title","descFull":"skill.1.6.desc","damage":6,"cooldown":900,"prev":[2],"next":[9],"x":4,"y":1,"img":"./images/hero/sorca/abil/2.png"},
    {"title":"skill.1.7.title","descFull":"skill.1.7.desc","prev":[2],"next":[10],"x":5,"y":1,"img":"./images/hero/sorca/abil/6.png"},
    {"title":"skill.1.8.title","descFull":"skill.1.8.desc","descFullL2":"skill.1.8.desc2","prev":[4],"next":[11,12],"x":1,"y":2,"img":"./images/hero/sorca/abil/1.png"},
    {"title":"skill.1.9.title","descFull":"skill.1.9.desc","cooldown":1200,"prev":[5,6],"next":[12,13],"x":3,"y":2,"img":"./images/hero/sorca/abil/8.png"},
    {"title":"skill.1.10.title","descFull":"skill.1.10.desc","prev":[7],"next":0,"x":5,"y":2,"img":"./images/hero/sorca/abil/9.png"},
    {"title":"skill.1.11.title","descFull":"skill.1.11.desc","descFullL2":"skill.1.11.desc2","prev":[8],"next":0,"x":1,"y":3,"img":"./images/hero/sorca/abil/12.png"},
    {"title":"skill.1.12.title","descFull":"skill.1.12.desc","prev":[8,9],"next":0,"x":2,"y":3,"img":"./images/hero/sorca/abil/3.png"},
    {"title":"skill.1.13.title","descFull":"skill.1.13.desc","prev":[9],"next":0,"x":3,"y":3,"img":"./images/hero/sorca/abil/14.png"},
],
},
{"className":"hero.2.name","weapon":5,"img":"./images/UI/doll/knight.png","anims":[
    {"move":[
        {"speed":8,"times":4,"w":128,"h":51,"img":"./images/hero/knight/move/back.png"},
        {"speed":8,"times":4,"w":128,"h":51,"img":"./images/hero/knight/move/front.png"},
        {"speed":8,"times":4,"w":128,"h":51,"img":"./images/hero/knight/move/left.png"},
        {"speed":8,"times":4,"w":128,"h":51,"img":"./images/hero/knight/move/right.png"}
    ]},
    {"attack":[
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/knight/attack/back.png","once":1,"new":{"step":3,"anim":[0,0]}},
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/knight/attack/front.png","once":1,"new":{"step":3,"anim":[0,1]}},
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/knight/attack/left.png","once":1,"new":{"step":3,"anim":[0,2]}},
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/knight/attack/right.png","once":1,"new":{"step":3,"anim":[0,3]}}
    ]},
    {"others":[
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/knight/others/damage.png","once":1,"stun":1},
        {"speed":5,"times":4,"w":128,"h":51,"img":"./images/hero/knight/others/death.png","once":1},
        {"speed":5,"times":4,"w":128,"h":51,"img":"./images/hero/knight/others/wait.png","once":1}
    ]}
],"stats":[
    {"name":"stat.2.0","value":5,"dops":[{"name":"dop.2.0.0","desc":"","value1":0,"value2":0},{"name":"dop.2.0.1","desc":"","value1":0,"value2":0},{"name":"dop.2.0.2","desc":"","value1":0,"value2":0}]},
    {"name":"stat.2.1","value":3,"dops":[{"name":"dop.2.1.0","desc":"","value1":0,"value2":0},{"name":"dop.2.1.1","desc":"","value1":0,"value2":0},{"name":"dop.2.1.2","desc":"","value1":0,"value2":0}]},
    {"name":"stat.2.2","value":7,"dops":[{"name":"dop.2.2.0","desc":"","value1":0,"value2":0},{"name":"dop.2.2.1","desc":"","value1":0,"value2":0},{"name":"dop.2.2.2","desc":"","value1":0,"value2":0}]},
    {"name":"stat.2.3","value":2,"dops":[{"name":"dop.2.3.0","desc":"","value1":0,"value2":0},{"name":"dop.2.3.1","desc":"","value1":0,"value2":0},{"name":"dop.2.3.2","desc":"","value1":0,"value2":0}]},
    {"name":"stat.2.4","value":3,"dops":[{"name":"dop.2.4.0","desc":"","value1":0,"value2":0},{"name":"dop.2.4.1","desc":"","value1":0,"value2":0},{"name":"dop.2.4.2","desc":"","value1":0,"value2":0}]}
],
"skills":[
    {"title":"skill.2.0.title","descFull":"skill.2.0.desc","descFullL2":"skill.2.0.desc2","descFullL3":"skill.2.0.desc3","prev":0,"next":[2,3],"x":1,"y":0,"img":"./images/hero/knight/abil/13.png"},
    {"title":"skill.2.1.title","descFull":"skill.2.1.desc","duration":900,"cooldown":600,"prev":0,"next":[4,5],"x":4,"y":0,"img":"./images/hero/knight/abil/7.png"},
    {"title":"skill.2.2.title","descFull":"skill.2.2.desc","descFullL2":"skill.2.2.desc2","descFullL3":"skill.2.2.desc3","cooldown":600,"prev":[0],"next":[6],"x":0,"y":1,"img":"./images/hero/knight/abil/10.png"},
    {"title":"skill.2.3.title","descFull":"skill.2.3.desc","prev":[0],"next":[7,8],"x":2,"y":1,"img":"./images/hero/knight/abil/5.png"},
    {"title":"skill.2.4.title","descFull":"skill.2.4.desc","prev":[1],"next":[7,8],"x":3,"y":1,"img":"./images/hero/knight/abil/4.png"},
    {"title":"skill.2.5.title","descFull":"skill.2.5.desc","prev":[1],"next":[9],"x":5,"y":1,"img":"./images/hero/knight/abil/8.png"},
    {"title":"skill.2.6.title","descFull":"skill.2.6.desc","descFullL2":"skill.2.6.desc2","prev":[2],"next":[10,11],"x":0,"y":2,"img":"./images/hero/knight/abil/2.png"},
    {"title":"skill.2.7.title","descFull":"skill.2.7.desc","prev":[3,4],"next":[11],"x":2,"y":2,"img":"./images/hero/knight/abil/6.png"},
    {"title":"skill.2.8.title","descFull":"skill.2.8.desc","prev":[3,4],"next":[12],"x":3,"y":2,"img":"./images/hero/knight/abil/1.png"},
    {"title":"skill.2.9.title","descFull":"skill.2.9.desc","descFullL2":"skill.2.9.desc2","prev":[5],"next":[12,13],"x":5,"y":2,"img":"./images/hero/knight/abil/11.png"},
    {"title":"skill.2.10.title","descFull":"skill.2.10.desc","prev":[6],"next":0,"x":0,"y":3,"img":"./images/hero/knight/abil/9.png"},
    {"title":"skill.2.11.title","descFull":"skill.2.11.desc","cooldown":300,"prev":[6,7],"next":0,"x":1,"y":3,"img":"./images/hero/knight/abil/12.png"},
    {"title":"skill.2.12.title","descFull":"skill.2.12.desc","prev":[8,9],"next":0,"x":4,"y":3,"img":"./images/hero/knight/abil/3.png"},
    {"title":"skill.2.13.title","descFull":"skill.2.13.desc","descFullL2":"skill.2.13.desc2","cooldown":1800,"prev":[9],"next":0,"x":5,"y":3,"img":"./images/hero/knight/abil/14.png"},
],
},
{"className":"hero.3.name","weapon":6,"img":"./images/UI/doll/valciria.png","anims":[
    {"move":[
        {"speed":8,"times":4,"w":128,"h":51,"img":"./images/hero/valca/move/back.png"},
        {"speed":8,"times":4,"w":128,"h":51,"img":"./images/hero/valca/move/front.png"},
        {"speed":8,"times":4,"w":128,"h":51,"img":"./images/hero/valca/move/left.png"},
        {"speed":8,"times":4,"w":128,"h":51,"img":"./images/hero/valca/move/right.png"}
    ]},
    {"attack":[
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/valca/attack/back.png","once":1,"new":{"step":3,"anim":[0,0]}},
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/valca/attack/front.png","once":1,"new":{"step":3,"anim":[0,1]}},
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/valca/attack/left.png","once":1,"new":{"step":3,"anim":[0,2]}},
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/valca/attack/right.png","once":1,"new":{"step":3,"anim":[0,3]}}
    ]},
    {"others":[
        {"speed":10,"times":4,"w":128,"h":51,"img":"./images/hero/valca/others/damage.png","once":1,"stun":1},
        {"speed":5,"times":4,"w":128,"h":51,"img":"./images/hero/valca/others/death.png","once":1},
        {"speed":5,"times":4,"w":128,"h":51,"img":"./images/hero/valca/others/wait.png","once":1}
    ]}
],"stats":[
    {"name":"stat.3.0","value":3,"dops":[{"name":"dop.3.0.0","desc":"","value1":0,"value2":0},{"name":"dop.3.0.1","desc":"","value1":0,"value2":0},{"name":"dop.3.0.2","desc":"","value1":0,"value2":0}]},
    {"name":"stat.3.1","value":4,"dops":[{"name":"dop.3.1.0","desc":"","value1":0,"value2":0},{"name":"dop.3.1.1","desc":"","value1":0,"value2":0},{"name":"dop.3.1.2","desc":"","value1":0,"value2":0}]},
    {"name":"stat.3.2","value":5,"dops":[{"name":"dop.3.2.0","desc":"","value1":0,"value2":0},{"name":"dop.3.2.1","desc":"","value1":0,"value2":0},{"name":"dop.3.2.2","desc":"","value1":0,"value2":0}]},
    {"name":"stat.3.3","value":7,"dops":[{"name":"dop.3.3.0","desc":"","value1":0,"value2":0},{"name":"dop.3.3.1","desc":"","value1":0,"value2":0},{"name":"dop.3.3.2","desc":"","value1":0,"value2":0}]},
    {"name":"stat.3.4","value":1,"dops":[{"name":"dop.3.4.0","desc":"","value1":0,"value2":0},{"name":"dop.3.4.1","desc":"","value1":0,"value2":0},{"name":"dop.3.4.2","desc":"","value1":0,"value2":0}]}
],
"skills":[
    {"title":"skill.3.0.title","descFull":"skill.3.0.desc","cooldown":360,"prev":0,"next":[4],"x":0,"y":0,"img":"./images/hero/valca/abil/13.png"},
    {"title":"skill.3.1.title","descFull":"skill.3.1.desc","descFullL2":"skill.3.1.desc2","prev":0,"next":[4,5,6],"x":2,"y":0,"img":"./images/hero/valca/abil/7.png"},
    {"title":"skill.3.2.title","descFull":"skill.3.2.desc","prev":0,"next":[5,6,7],"x":3,"y":0,"img":"./images/hero/valca/abil/10.png"},
    {"title":"skill.3.3.title","descFull":"skill.3.3.desc","descFullL2":"skill.3.3.desc2","descFullL3":"skill.3.3.desc3","duration":90,"cooldown":900,"prev":0,"next":[7],"x":5,"y":0,"img":"./images/hero/valca/abil/5.png"},
    {"title":"skill.3.4.title","descFull":"skill.3.4.desc","prev":[0,1],"next":[8,9],"x":1,"y":1,"img":"./images/hero/valca/abil/4.png"},
    {"title":"skill.3.5.title","descFull":"skill.3.5.desc","prev":[1,2],"next":[9],"x":2,"y":1,"img":"./images/hero/valca/abil/11.png"},
    {"title":"skill.3.6.title","descFull":"skill.3.6.desc","prev":[1,2],"next":[9,10],"x":3,"y":1,"img":"./images/hero/valca/abil/2.png"},
    {"title":"skill.3.7.title","descFull":"skill.3.7.desc","prev":[2,3],"next":[10],"x":4,"y":1,"img":"./images/hero/valca/abil/6.png"},
    {"title":"skill.3.8.title","descFull":"skill.3.8.desc","prev":[4],"next":0,"x":0,"y":2,"img":"./images/hero/valca/abil/1.png"},
    {"title":"skill.3.9.title","descFull":"skill.3.9.desc","descFullL2":"skill.3.9.desc2","prev":[4,5,6],"next":[11,12],"x":2,"y":2,"img":"./images/hero/valca/abil/8.png"},
    {"title":"skill.3.10.title","descFull":"skill.3.10.desc","prev":[6,7],"next":[12,13],"x":4,"y":2,"img":"./images/hero/valca/abil/9.png"},
    {"title":"skill.3.11.title","descFull":"skill.3.11.desc","duration":300,"cooldown":600,"prev":[9],"next":0,"x":1,"y":3,"img":"./images/hero/valca/abil/12.png"},
    {"title":"skill.3.12.title","descFull":"skill.3.12.desc","descFullL2":"skill.3.12.desc2","duration":300,"cooldown":1200,"prev":[9,10],"next":0,"x":3,"y":3,"img":"./images/hero/valca/abil/3.png"},
    {"title":"skill.3.13.title","descFull":"skill.3.13.desc","descFullL2":"skill.3.13.desc2","cooldown":1500,"prev":[10],"next":0,"x":5,"y":3,"img":"./images/hero/valca/abil/14.png"},
],
}],
"scenes":[
    {"w":11,"h":8,"floor":[[0,-6,11,8,2]],"objects":[[9,-2,1,32,64],[8,-1,1,32,64],[1,-2,2,64,64]],"walls":[[0,0,3,1,2],[1,0,19,1,2],[2,0,19,1,2],[3,0,19,1,2],[4,0,0,3,2],[7,0,19,1,2],[8,0,19,1,2],[9,0,19,1,2],[10,0,2,1,2],[0,-1,22,1,1],[0,-2,22,1,1],[0,-3,22,1,1],[0,-4,22,1,1],[0,-5,22,1,1],[10,-1,21,1,1],[10,-2,21,1,1],[10,-3,21,1,1],[10,-4,21,1,1],[10,-5,21,1,1],[0,-6,6,1,1],[0,-7,12,3,2],[2,-6,20,1,1],[3,-6,20,1,1],[4,-6,20,1,1],[5,-6,20,1,1],[6,-6,20,1,1],[7,-6,20,1,1],[8,-6,20,1,1],[9,-6,20,1,1],[10,-6,7,1,1]]}
   ],
"enemes":[
    [{"id":0,"name":"enemy.0.name","stats":{"hp":5,"dmg":[1,5],"exp":1,"speed":10,"range":6,"attacksCd":[],"noStunTime":55,"call": 8,"desc":"enemy.0.desc"},"attacks":[0],"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/goba/move/back.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/goba/move/front.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/goba/move/left.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/goba/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/goba/attack/back.png","once":1,"attackNew":{"step":3,"anim":[0,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/goba/attack/front.png","once":1,"attackNew":{"step":3,"anim":[0,1]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/goba/attack/left.png","once":1,"attackNew":{"step":3,"anim":[0,2]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/goba/attack/right.png","once":1,"attackNew":{"step":3,"anim":[0,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":128,"h":51,"img":"./images/enemy/goba/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/goba/others/death.png","once":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/goba/others/wait.png"}
        ]}
    ]}],
    [{"id":1,"name":"enemy.1.name","stats":{"hp":7,"dmg":[3,5],"exp":1,"speed":7,"range":6,"attacksCd":[],"noStunTime":60,"stoneskin":12,"desc":"enemy.1.desc"},"attacks":[4],"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/orc/move/back.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/orc/move/front.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/orc/move/left.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/orc/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/orc/attack/back.png","once":1,"attackNew":{"step":3,"anim":[4,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/orc/attack/front.png","once":1,"attackNew":{"step":3,"anim":[4,1]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/orc/attack/left.png","once":1,"attackNew":{"step":3,"anim":[4,2]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/orc/attack/right.png","once":1,"attackNew":{"step":3,"anim":[4,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":128,"h":51,"img":"./images/enemy/orc/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/orc/others/death.png","once":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/orc/others/wait.png"}
        ]}
    ]}],
    [{"id":2,"name":"enemy.2.name","stats":{"hp":8,"dmg":[2,5],"exp":4,"speed":6,"range":7,"attacksCd":[],"noStunTime":50},"attacks":[3],"elite":1,"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/shaman/move/back.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/shaman/move/front.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/shaman/move/left.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/shaman/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/shaman/attack/back.png","once":1,"attackNew":{"step":3,"anim":[3,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/shaman/attack/front.png","once":1,"attackNew":{"step":3,"anim":[3,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/shaman/attack/left.png","once":1,"attackNew":{"step":3,"anim":[3,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/shaman/attack/right.png","once":1,"attackNew":{"step":3,"anim":[3,0]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":128,"h":51,"img":"./images/enemy/shaman/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/shaman/others/death.png","once":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/shaman/others/wait.png"}
        ]}
    ]},
    {"id":3,"name":"enemy.3.name","stats":{"hp":10,"dmg":[3,5],"exp":4,"speed":5,"range":7,"attacksCd":[],"noStunTime":50},"attacks":[10],"elite":1,"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":3,"times":4,"w":128,"h":51,"img":"./images/enemy/ogr/move/back.png"},
            {"speed":3,"times":4,"w":128,"h":51,"img":"./images/enemy/ogr/move/front.png"},
            {"speed":3,"times":4,"w":128,"h":51,"img":"./images/enemy/ogr/move/left.png"},
            {"speed":3,"times":4,"w":128,"h":51,"img":"./images/enemy/ogr/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/ogr/attack/back.png","once":1,"attackNew":{"step":3,"anim":[10,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/ogr/attack/front.png","once":1,"attackNew":{"step":3,"anim":[10,1]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/ogr/attack/left.png","once":1,"attackNew":{"step":3,"anim":[10,2]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/ogr/attack/right.png","once":1,"attackNew":{"step":3,"anim":[10,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":128,"h":51,"img":"./images/enemy/ogr/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/ogr/others/death.png","once":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/ogr/others/wait.png"}
        ]}
    ]}],
    [{"id":4,"name":"enemy.4.name","boss":1,"stats":{"hp":40,"dmg":[5,6],"exp":10,"speed":10,"range":7,"attacksCd":[],"noStunTime":120,"rage": 8,"desc":"enemy.4.desc"},"attacks":[9],"elite":1,"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/lider/move/back.png"},
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/lider/move/front.png"},
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/lider/move/left.png"},
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/lider/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/lider/attack/back.png","once":1,"attackNew":{"step":3,"anim":[9,0]}},
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/lider/attack/front.png","once":1,"attackNew":{"step":3,"anim":[9,1]}},
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/lider/attack/left.png","once":1,"attackNew":{"step":3,"anim":[9,2]}},
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/lider/attack/right.png","once":1,"attackNew":{"step":3,"anim":[9,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":256,"h":64,"img":"./images/enemy/lider/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/lider/others/death.png","once":1},
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/lider/others/wait.png"}
        ]}
    ]}],
    [{"id":5,"name":"enemy.5.name","stats":{"hp":20,"dmg":[2,6],"exp":6,"speed":8,"range":6,"attacksCd":[],"noStunTime":120, "reanimate": 0.5,"desc":"enemy.5.desc"},"attacks":[7],"elite":1,"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/mummy/move/back.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/mummy/move/front.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/mummy/move/left.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/mummy/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/mummy/attack/back.png","once":1,"attackNew":{"step":3,"anim":[7,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/mummy/attack/front.png","once":1,"attackNew":{"step":3,"anim":[7,1]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/mummy/attack/left.png","once":1,"attackNew":{"step":3,"anim":[7,2]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/mummy/attack/right.png","once":1,"attackNew":{"step":3,"anim":[7,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":128,"h":51,"img":"./images/enemy/mummy/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/mummy/others/death.png","once":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/mummy/others/wait.png"}
        ]}
    ]}],
    [{"id":6,"name":"enemy.6.name","stats":{"hp":1,"dmg":[1,2],"exp":1,"speed":12,"range":12,"attacksCd":[],"noStunTime":120, "pet": 1, "desc":"enemy.6.desc"},"attacks":[11],"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/rat/move/back.png"},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/rat/move/front.png"},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/rat/move/left.png"},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/rat/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/rat/attack/back.png","once":1,"attackNew":{"step":3,"anim":[11,0]}},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/rat/attack/front.png","once":1,"attackNew":{"step":3,"anim":[11,1]}},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/rat/attack/left.png","once":1,"attackNew":{"step":3,"anim":[11,2]}},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/rat/attack/right.png","once":1,"attackNew":{"step":3,"anim":[11,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":128,"h":32,"img":"./images/enemy/rat/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/rat/others/death.png","once":1}
        ]}
    ]}],
    [{"id":7,"name":"enemy.7.name","stats":{"hp":20,"dmg":[4,7],"exp":1,"speed":9,"range":6,"attacksCd":[],"noStunTime":60,"desc":"enemy.7.desc"},"attacks":[1],"effects":{"takeDamage":1},"skills":[0],"anims":[
        {"move":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dwarf/move/back.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dwarf/move/front.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dwarf/move/left.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dwarf/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dwarf/attack/back.png","once":1,"attackNew":{"step":3,"anim":[1,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dwarf/attack/front.png","once":1,"attackNew":{"step":3,"anim":[1,1]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dwarf/attack/left.png","once":1,"attackNew":{"step":3,"anim":[1,2]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dwarf/attack/right.png","once":1,"attackNew":{"step":3,"anim":[1,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":128,"h":51,"img":"./images/enemy/dwarf/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dwarf/others/death.png","once":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dwarf/others/wait.png"}
        ]}
    ]}],
    [{"id":8,"name":"enemy.8.name","stats":{"hp":35,"dmg":[7,12],"exp":1,"speed":9,"range":6,"attacksCd":[],"noStunTime":70,"crushAttack":1,"desc":"enemy.8.desc"},"attacks":[13],"effects":{"takeDamage":0},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spike/move/back.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spike/move/front.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spike/move/left.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spike/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spike/attack/back.png","once":1,"attackNew":{"step":3,"anim":[13,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spike/attack/front.png","once":1,"attackNew":{"step":3,"anim":[13,1]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spike/attack/left.png","once":1,"attackNew":{"step":3,"anim":[13,2]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spike/attack/right.png","once":1,"attackNew":{"step":3,"anim":[13,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":128,"h":51,"img":"./images/enemy/spike/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spike/others/death.png","once":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spike/others/wait.png"}
        ]}
    ]}],
    [{"id":9,"name":"enemy.9.name","stats":{"hp":32,"dmg":[1,3],"poison":6,"exp":4,"speed":6,"range":7,"attacksCd":[],"noStunTime":60,"desc":"enemy.9.desc"},"attacks":[15],"elite":1,"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spiderman/move/back.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spiderman/move/front.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spiderman/move/left.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spiderman/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spiderman/attack/back.png","once":1,"attackNew":{"step":3,"anim":[15,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spiderman/attack/front.png","once":1,"attackNew":{"step":3,"anim":[15,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spiderman/attack/left.png","once":1,"attackNew":{"step":3,"anim":[15,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spiderman/attack/right.png","once":1,"attackNew":{"step":3,"anim":[15,0]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":128,"h":51,"img":"./images/enemy/spiderman/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spiderman/others/death.png","once":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/spiderman/others/wait.png"}
        ]}
    ]},
    {"id":10,"name":"enemy.10.name","stats":{"hp":42,"dmg":[1,4],"exp":4,"speed":7,"range":8,"attacksCd":[],"noStunTime":50,"desc":"enemy.10.desc"},"attacks":[14],"elite":1,"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":3,"times":4,"w":128,"h":51,"img":"./images/enemy/octopus/move/back.png"},
            {"speed":3,"times":4,"w":128,"h":51,"img":"./images/enemy/octopus/move/front.png"},
            {"speed":3,"times":4,"w":128,"h":51,"img":"./images/enemy/octopus/move/left.png"},
            {"speed":3,"times":4,"w":128,"h":51,"img":"./images/enemy/octopus/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/octopus/attack/back.png","once":1,"attackNew":{"step":3,"anim":[14,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/octopus/attack/front.png","once":1,"attackNew":{"step":3,"anim":[14,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/octopus/attack/left.png","once":1,"attackNew":{"step":3,"anim":[14,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/octopus/attack/right.png","once":1,"attackNew":{"step":3,"anim":[14,0]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":128,"h":51,"img":"./images/enemy/octopus/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/octopus/others/death.png","once":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/octopus/others/wait.png"}
        ]}
    ]}],
    [{"id":11,"name":"enemy.11.name","boss":1,"stats":{"hp":300,"dmg":[8,14],"exp":10,"speed":9,"range":7,"attacksCd":[],"noStunTime":120,"desc":"enemy.11.desc"},"attacks":[17],"elite":1,"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/spiderboss/move/back.png"},
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/spiderboss/move/front.png"},
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/spiderboss/move/left.png"},
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/spiderboss/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/spiderboss/attack/back.png","once":1,"attackNew":{"step":3,"anim":[17,0]}},
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/spiderboss/attack/front.png","once":1,"attackNew":{"step":3,"anim":[17,1]}},
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/spiderboss/attack/left.png","once":1,"attackNew":{"step":3,"anim":[17,2]}},
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/spiderboss/attack/right.png","once":1,"attackNew":{"step":3,"anim":[17,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":256,"h":64,"img":"./images/enemy/spiderboss/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/spiderboss/others/death.png","once":1},
            {"speed":5,"times":4,"w":256,"h":64,"img":"./images/enemy/spiderboss/others/wait.png"}
        ]}
    ]}],
    [{"id":12,"name":"enemy.12.name","stats":{"hp":80,"dmg":[6,12],"exp":6,"speed":8,"range":6,"attacksCd":[],"noStunTime":120,"shadow":5,"desc":"enemy.12.desc"},"attacks":[6],"elite":1,"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dark/move/back.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dark/move/front.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dark/move/left.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dark/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dark/attack/back.png","once":1,"attackNew":{"step":3,"anim":[6,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dark/attack/front.png","once":1,"attackNew":{"step":3,"anim":[6,1]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dark/attack/left.png","once":1,"attackNew":{"step":3,"anim":[6,2]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dark/attack/right.png","once":1,"attackNew":{"step":3,"anim":[6,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":128,"h":51,"img":"./images/enemy/dark/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dark/others/death.png","once":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/dark/others/wait.png"}
        ]}
    ]}],
    [{"id":13,"name":"enemy.13.name","stats":{"hp":8,"dmg":[1,4],"poison":2,"exp":1,"speed":10,"range":12,"attacksCd":[],"noStunTime":120,"desc":"enemy.13.desc"},"attacks":[11],"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spider/move/back.png"},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spider/move/front.png"},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spider/move/left.png"},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spider/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spider/attack/back.png","once":1,"attackNew":{"step":3,"anim":[11,0]}},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spider/attack/front.png","once":1,"attackNew":{"step":3,"anim":[11,1]}},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spider/attack/left.png","once":1,"attackNew":{"step":3,"anim":[11,2]}},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spider/attack/right.png","once":1,"attackNew":{"step":3,"anim":[11,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":128,"h":32,"img":"./images/enemy/spider/others/death.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spider/others/death.png","once":1}
        ]}
    ]}],
    [{"id":14,"name":"enemy.14.name","stats":{"hp":50,"dmg":[6,9],"exp":1,"speed":8,"range":5,"attacksCd":[],"noStunTime":70,"flame": 2,"desc":"enemy.14.desc"},"attacks":[9],"effects":{"takeDamage":1},"skills":[0],"anims":[
        {"move":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/imp/move/back.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/imp/move/front.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/imp/move/left.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/imp/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/imp/attack/back.png","once":1,"attackNew":{"step":3,"anim":[9,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/imp/attack/front.png","once":1,"attackNew":{"step":3,"anim":[9,1]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/imp/attack/left.png","once":1,"attackNew":{"step":3,"anim":[9,2]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/imp/attack/right.png","once":1,"attackNew":{"step":3,"anim":[9,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":128,"h":51,"img":"./images/enemy/imp/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/imp/others/death.png","once":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/imp/others/wait.png"}
        ]}
    ]}],
    [{"id":15,"name":"enemy.15.name","stats":{"hp":45,"dmg":[7,12],"exp":1,"speed":6,"range":6,"attacksCd":[],"noStunTime":80,"dash": 4,"desc":"enemy.15.desc"},"attacks":[0],"effects":{"takeDamage":0},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/bat/move/back.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/bat/move/front.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/bat/move/left.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/bat/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/bat/attack/back.png","once":1,"attackNew":{"step":3,"anim":[0,0]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/bat/attack/front.png","once":1,"attackNew":{"step":3,"anim":[0,1]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/bat/attack/left.png","once":1,"attackNew":{"step":3,"anim":[0,2]}},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/bat/attack/right.png","once":1,"attackNew":{"step":3,"anim":[0,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":128,"h":51,"img":"./images/enemy/bat/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/bat/others/death.png","once":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/bat/others/wait.png"}
        ]}
    ]}],
    [{"id":16,"name":"enemy.16.name","stats":{"hp":70,"dmg":[4,9],"exp":4,"speed":6,"range":8,"attacksCd":[],"noStunTime":65, "charm": 1,"desc":"enemy.16.desc"},"attacks":[8],"elite":1,"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":192,"h":51,"img":"./images/enemy/succubus/move/back.png"},
            {"speed":5,"times":4,"w":192,"h":51,"img":"./images/enemy/succubus/move/front.png"},
            {"speed":5,"times":4,"w":192,"h":51,"img":"./images/enemy/succubus/move/left.png"},
            {"speed":5,"times":4,"w":192,"h":51,"img":"./images/enemy/succubus/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":192,"h":51,"img":"./images/enemy/succubus/attack/back.png","once":1,"attackNew":{"step":3,"anim":[8,0]}},
            {"speed":5,"times":4,"w":192,"h":51,"img":"./images/enemy/succubus/attack/front.png","once":1,"attackNew":{"step":3,"anim":[8,0]}},
            {"speed":5,"times":4,"w":192,"h":51,"img":"./images/enemy/succubus/attack/left.png","once":1,"attackNew":{"step":3,"anim":[8,0]}},
            {"speed":5,"times":4,"w":192,"h":51,"img":"./images/enemy/succubus/attack/right.png","once":1,"attackNew":{"step":3,"anim":[8,0]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":192,"h":51,"img":"./images/enemy/succubus/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":192,"h":51,"img":"./images/enemy/succubus/others/death.png","once":1},
            {"speed":5,"times":4,"w":192,"h":51,"img":"./images/enemy/succubus/others/wait.png"}
        ]}
    ]},
    {"id":17,"name":"enemy.17.name","stats":{"hp":55,"dmg":[12,14],"exp":4,"speed":10,"range":8,"attacksCd":[],"noStunTime":75, "howl": 6, "desc":"enemy.17.desc"},"attacks":[19],"elite":1,"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":3,"times":4,"w":192,"h":51,"img":"./images/enemy/hound/move/back.png"},
            {"speed":3,"times":4,"w":192,"h":51,"img":"./images/enemy/hound/move/front.png"},
            {"speed":3,"times":4,"w":192,"h":51,"img":"./images/enemy/hound/move/left.png"},
            {"speed":3,"times":4,"w":192,"h":51,"img":"./images/enemy/hound/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":192,"h":51,"img":"./images/enemy/hound/attack/back.png","once":1,"attackNew":{"step":3,"anim":[19,0]}},
            {"speed":5,"times":4,"w":192,"h":51,"img":"./images/enemy/hound/attack/front.png","once":1,"attackNew":{"step":3,"anim":[19,1]}},
            {"speed":5,"times":4,"w":192,"h":51,"img":"./images/enemy/hound/attack/left.png","once":1,"attackNew":{"step":3,"anim":[19,2]}},
            {"speed":5,"times":4,"w":192,"h":51,"img":"./images/enemy/hound/attack/right.png","once":1,"attackNew":{"step":3,"anim":[19,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":192,"h":51,"img":"./images/enemy/hound/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":192,"h":51,"img":"./images/enemy/hound/others/death.png","once":1},
            {"speed":5,"times":4,"w":192,"h":51,"img":"./images/enemy/hound/others/wait.png"}
        ]}
    ]}],
    [{"id":18,"name":"enemy.18.name","boss":1,"stats":{"hp":500,"dmg":[16,20],"exp":10,"speed":10,"range":11,"attacksCd":[],"noStunTime":180, "summoning": 4, "desc":"enemy.18.desc"},"attacks":[20],"elite":1,"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/demon/move/back.png"},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/demon/move/front.png"},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/demon/move/left.png"},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/demon/move/right.png"}
        ]},
        {"attack":[
            {"speed":4,"times":4,"w":512,"h":128,"img":"./images/enemy/demon/attack/back.png","once":1,"attackNew":{"step":3,"anim":[20,0]}},
            {"speed":4,"times":4,"w":512,"h":128,"img":"./images/enemy/demon/attack/front.png","once":1,"attackNew":{"step":3,"anim":[20,1]}},
            {"speed":4,"times":4,"w":512,"h":128,"img":"./images/enemy/demon/attack/left.png","once":1,"attackNew":{"step":3,"anim":[20,2]}},
            {"speed":4,"times":4,"w":512,"h":128,"img":"./images/enemy/demon/attack/right.png","once":1,"attackNew":{"step":3,"anim":[20,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":512,"h":128,"img":"./images/enemy/demon/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/demon/others/death.png","once":1},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/demon/others/wait.png"}
        ]}
    ]}],
    [{"id":19,"name":"enemy.19.name","stats":{"hp":120,"dmg":[6,12],"exp":6,"speed":9,"range":8,"attacksCd":[],"noStunTime":150,"vampirism":10,"desc":"enemy.19.desc"},"attacks":[11],"elite":1,"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/vampire/move/back.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/vampire/move/front.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/vampire/move/left.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/vampire/move/right.png"}
        ]},
        {"attack":[
            {"speed":7,"times":4,"w":128,"h":51,"img":"./images/enemy/vampire/attack/back.png","once":1,"attackNew":{"step":3,"anim":[11,0]}},
            {"speed":7,"times":4,"w":128,"h":51,"img":"./images/enemy/vampire/attack/front.png","once":1,"attackNew":{"step":3,"anim":[11,1]}},
            {"speed":7,"times":4,"w":128,"h":51,"img":"./images/enemy/vampire/attack/left.png","once":1,"attackNew":{"step":3,"anim":[11,2]}},
            {"speed":7,"times":4,"w":128,"h":51,"img":"./images/enemy/vampire/attack/right.png","once":1,"attackNew":{"step":3,"anim":[11,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":128,"h":51,"img":"./images/enemy/vampire/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/vampire/others/death.png","once":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/vampire/others/wait.png"}
        ]}
    ]}],
    [{"id":20,"name":"enemy.20.name","stats":{"hp":16,"dmg":[2,6], "exp":1,"speed":10,"range":12,"attacksCd":[],"noStunTime":120, "flame": 1, "desc":"enemy.20.desc"},"attacks":[11],"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spiderRed/move/back.png"},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spiderRed/move/front.png"},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spiderRed/move/left.png"},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spiderRed/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spiderRed/attack/back.png","once":1,"attackNew":{"step":3,"anim":[11,0]}},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spiderRed/attack/front.png","once":1,"attackNew":{"step":3,"anim":[11,1]}},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spiderRed/attack/left.png","once":1,"attackNew":{"step":3,"anim":[11,2]}},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spiderRed/attack/right.png","once":1,"attackNew":{"step":3,"anim":[11,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":128,"h":32,"img":"./images/enemy/spiderRed/others/death.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":128,"h":32,"img":"./images/enemy/spiderRed/others/death.png","once":1}
        ]}
    ]}],
    //V65: 4 этаж («Пустота») — босс «Циклоп Пустоты» (id 25). Статы и атаки — от «Демона»
    //(id 18), с V66 анимации — СОБСТВЕННЫЕ спрайты /enemy/cyclop/ (те же листы 512×128,
    //до этого стояли демонские как заглушка); способность «summoning» НЕ перенесена —
    //вместо неё своя особая способность «voidBlob»: N (секунды) — раз в N
    //секунд выпускает Сгусток пустоты (voidBoss.js). Группа 18 = первая (и единственная)
    //группа врагов 4 этажа; id 25 = 7*3+4 по схеме боссов этажей (4/11/18/25)
    [{"id":25,"name":"enemy.25.name","boss":1,"stats":{"hp":1000,"dmg":[20,26],"exp":10,"speed":11,"range":11,"attacksCd":[],"noStunTime":360, "voidBlob": 4, "desc":"enemy.25.desc", "invulnerability": 16},"attacks":[21],"elite":1,"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/cyclop/move/back.png"},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/cyclop/move/front.png"},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/cyclop/move/left.png"},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/cyclop/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/cyclop/attack/back.png","once":1,"attackNew":{"step":3,"anim":[21,0]}},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/cyclop/attack/front.png","once":1,"attackNew":{"step":3,"anim":[21,1]}},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/cyclop/attack/left.png","once":1,"attackNew":{"step":3,"anim":[21,2]}},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/cyclop/attack/right.png","once":1,"attackNew":{"step":3,"anim":[21,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":512,"h":128,"img":"./images/enemy/cyclop/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/cyclop/others/death.png","once":1},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/cyclop/others/wait.png"}
        ]}
    ]},
    //V85: второй босс 4 этажа — «Медуза пустоты» (id 26, ВТОРОЙ ЭЛЕМЕНТ группы 18): спавнится СЛУЧАЙНО (50/50,
    //voidBoss.spawnVoidBoss) вместо Циклопа. Статы — от Циклопа (id 25), его особые
    //способности (voidBlob, invulnerability) НЕ перенесены — вместо них своя способность
    //«segmentation»: при падении ХП до половины максимума и ниже сущность (босс или осколок
    //со счётчиком > 0) делится надвое — осколки вдвое меньше (спрайты, анимации и эффект
    //атаки), макс ХП каждого = ОСТАТОК ХП делившегося, счётчик уменьшается на каждое
    //деление (2 → 1 → 0; предел — микро-осколки). Обычная атака — «Звезда пустоты» (21),
    //у осколков её уменьшенные копии 22 (×0.5) и 23 (×0.25)
    {"id":26,"name":"enemy.26.name","boss":1,"stats":{"hp":1000,"dmg":[14,20],"exp":10,"speed":8,"range":14,"attacksCd":[],"noStunTime":360, "segmentation": 2, "desc":"enemy.26.desc"},"attacks":[21],"elite":1,"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/medusa/move/back.png"},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/medusa/move/front.png"},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/medusa/move/left.png"},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/medusa/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/medusa/attack/back.png","once":1,"attackNew":{"step":3,"anim":[21,0]}},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/medusa/attack/front.png","once":1,"attackNew":{"step":3,"anim":[21,1]}},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/medusa/attack/left.png","once":1,"attackNew":{"step":3,"anim":[21,2]}},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/medusa/attack/right.png","once":1,"attackNew":{"step":3,"anim":[21,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":512,"h":128,"img":"./images/enemy/medusa/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/medusa/others/death.png","once":1},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/medusa/others/wait.png"}
        ]}
    ]},
    //V91: третий босс 4 этажа — «Гриб пустоты» (id 27, ТРЕТИЙ ЭЛЕМЕНТ группы 18):
    //спавнится случайно (1 из 3 — nextFloor). Поведение — как у Циклопа, его способности
    //(voidBlob, invulnerability) НЕ перенесены; своя способность «spore» (секунды в
    //data.js): раз в N секунд разбрасывает 10 спор — по параболе в случайные свободные
    //клетки комнаты (voidBoss.js); наступание героя уничтожает спору, невытоптанная
    //через 8 секунд прорастает мини-грибом (клон без тега boss, ХП/урон/опыт 1/10,
    //размер 1/5, скорость полная — решения пользователя). При смерти босса споры
    //исчезают. Анимации — собственные /enemy/mushroom/ (лист forWork/sprites/mushroom_128)
    {"id":27,"name":"enemy.27.name","boss":1,"stats":{"hp":1000,"dmg":[20,26],"exp":10,"speed":11,"range":11,"attacksCd":[],"noStunTime":360, "spore": 10, "desc":"enemy.27.desc"},"attacks":[21],"elite":1,"effects":{"takeDamage":1},"anims":[
        {"move":[
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/mushroom/move/back.png"},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/mushroom/move/front.png"},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/mushroom/move/left.png"},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/mushroom/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/mushroom/attack/back.png","once":1,"attackNew":{"step":3,"anim":[21,0]}},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/mushroom/attack/front.png","once":1,"attackNew":{"step":3,"anim":[21,1]}},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/mushroom/attack/left.png","once":1,"attackNew":{"step":3,"anim":[21,2]}},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/mushroom/attack/right.png","once":1,"attackNew":{"step":3,"anim":[21,3]}}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":512,"h":128,"img":"./images/enemy/mushroom/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/mushroom/others/death.png","once":1},
            {"speed":5,"times":4,"w":512,"h":128,"img":"./images/enemy/mushroom/others/wait.png"}
        ]}
    ]}],
],
"attacks":[
    {"name":"attack.0.name","base":1,"cooldown":0.5,"img":"./images/attacks/dagger/icon.png", "anims":[
        {"img":"./images/attacks/dagger/back.png","once":1,"times":4,"speed":20,"w":128,"h":32,"x":0,"y":-32},
        {"img":"./images/attacks/dagger/front.png","once":1,"times":4,"speed":20,"w":128,"h":32,"x":0,"y":32},
        {"img":"./images/attacks/dagger/left.png","once":1,"times":4,"speed":20,"w":128,"h":32,"x":-32,"y":0},
        {"img":"./images/attacks/dagger/right.png","once":1,"times":4,"speed":20,"w":128,"h":32,"x":32,"y":0},
    ]},
    {"name":"attack.1.name","base":1,"cooldown":0.6,"img":"./images/attacks/axe/icon.png", "anims":[
        {"img":"./images/attacks/axe/back.png","once":1,"times":4,"speed":20,"w":256,"h":32,"x":0,"y":-32},
        {"img":"./images/attacks/axe/front.png","once":1,"times":4,"speed":20,"w":256,"h":32,"x":0,"y":32},
        {"img":"./images/attacks/axe/left.png","once":1,"times":4,"speed":20,"w":128,"h":64,"x":-32,"y":0},
        {"img":"./images/attacks/axe/right.png","once":1,"times":4,"speed":20,"w":128,"h":64,"x":32,"y":0},
    ]},
    {"name":"attack.2.name","base":1,"cooldown":1.2,"range":6,"img":"./images/attacks/bow/icon.png", "anims":[
        {"img":"./images/attacks/bow/back.png","bullet":"top","bulletSpeed":4,"effect":0,"times":1,"speed":20,"w":14,"h":32,"x":0,"y":-288},
        {"img":"./images/attacks/bow/front.png","bullet":"down","bulletSpeed":4,"effect":0,"times":1,"speed":20,"w":14,"h":32,"x":0,"y":32},
        {"img":"./images/attacks/bow/left.png","bullet":"left","bulletSpeed":4,"effect":0,"times":1,"speed":20,"w":32,"h":14,"x":-288,"y":0},
        {"img":"./images/attacks/bow/right.png","bullet":"right","bulletSpeed":4,"effect":0,"times":1,"speed":20,"w":32,"h":14,"x":32,"y":0},
    ]},
    {"name":"attack.3.name","base":1,"type":"magic","cooldown":1.1,"range":6,"img":"./images/attacks/staff/icon.png", "anims":[
        {"img":"./images/attacks/staff/all.png","bullet":"all","bulletSpeed":2,"effect":0,"times":4,"speed":20,"w":128,"h":32,"x":0,"y":0}
    ]},
    {"name":"attack.4.name","base":1,"cooldown":0.8,"img":"./images/attacks/mace/icon.png", "anims":[
        {"img":"./images/attacks/mace/all.png","once":1,"times":4,"speed":15,"w":192,"h":48,"x":0,"y":-48},
        {"img":"./images/attacks/mace/all.png","once":1,"times":4,"speed":15,"w":192,"h":48,"x":0,"y":48},
        {"img":"./images/attacks/mace/all.png","once":1,"times":4,"speed":15,"w":192,"h":48,"x":-48,"y":0},
        {"img":"./images/attacks/mace/all.png","once":1,"times":4,"speed":15,"w":192,"h":48,"x":48,"y":0},
    ]},
    {"name":"attack.5.name","base":1,"cooldown":0.7,"img":"./images/attacks/sword/icon.png", "anims":[
        {"img":"./images/attacks/sword/back.png","once":1,"times":4,"speed":15,"w":128,"h":48,"x":0,"y":-48},
        {"img":"./images/attacks/sword/front.png","once":1,"times":4,"speed":15,"w":128,"h":48,"x":0,"y":48},
        {"img":"./images/attacks/sword/left.png","once":1,"times":4,"speed":15,"w":192,"h":32,"x":-48,"y":0},
        {"img":"./images/attacks/sword/right.png","once":1,"times":4,"speed":15,"w":192,"h":32,"x":48,"y":0},
    ]},
    {"name":"attack.6.name","base":1,"cooldown":0.9,"img":"./images/attacks/spear/icon.png", "anims":[
        {"img":"./images/attacks/spear/back.png","once":1,"times":4,"speed":15,"w":96,"h":64,"x":0,"y":-64},
        {"img":"./images/attacks/spear/front.png","once":1,"times":4,"speed":15,"w":96,"h":64,"x":0,"y":64},
        {"img":"./images/attacks/spear/left.png","once":1,"times":4,"speed":15,"w":256,"h":24,"x":-64,"y":0},
        {"img":"./images/attacks/spear/right.png","once":1,"times":4,"speed":15,"w":256,"h":24,"x":64,"y":0},
    ]},
    {"name":"attack.7.name","base":1,"cooldown":0.9,"img":"./images/attacks/twoHandedSword/icon.png", "anims":[
        {"img":"./images/attacks/twoHandedSword/all.png","once":1,"times":4,"speed":15,"w":388,"h":96,"x":0,"y":0},
        {"img":"./images/attacks/twoHandedSword/all.png","once":1,"times":4,"speed":15,"w":388,"h":96,"x":0,"y":0},
        {"img":"./images/attacks/twoHandedSword/all.png","once":1,"times":4,"speed":15,"w":388,"h":96,"x":0,"y":0},
        {"img":"./images/attacks/twoHandedSword/all.png","once":1,"times":4,"speed":15,"w":388,"h":96,"x":0,"y":0},
    ]},
    {"name":"attack.8.name","base":1,"type":"magic","cooldown":1,"range":5,"img":"./images/attacks/wand/icon.png", "anims":[
        {"img":"./images/attacks/wand/all.png","bullet":"all","bulletSpeed":3,"effect":0,"times":4,"speed":15,"w":96,"h":24,"x":0,"y":0}
    ]},
    {"name":"attack.9.name","base":1,"cooldown":0.85,"img":"./images/attacks/alebard/icon.png", "anims":[
        {"img":"./images/attacks/alebard/back.png","once":1,"times":4,"speed":20,"w":384,"h":64,"x":0,"y":-32},
        {"img":"./images/attacks/alebard/front.png","once":1,"times":4,"speed":20,"w":384,"h":64,"x":0,"y":32},
        {"img":"./images/attacks/alebard/left.png","once":1,"times":4,"speed":20,"w":256,"h":96,"x":-32,"y":0},
        {"img":"./images/attacks/alebard/right.png","once":1,"times":4,"speed":20,"w":256,"h":96,"x":32,"y":0},
    ]},
    {"name":"attack.10.name","base":1,"cooldown":1.2,"range":8,"img":"./images/attacks/bow/icon.png", "anims":[
        {"img":"./images/attacks/club/all.png","bullet":"top","bulletSpeed":2,"effect":0,"times":4,"speed":10,"w":192,"h":48,"x":0,"y":-48},
        {"img":"./images/attacks/club/all.png","bullet":"down","bulletSpeed":2,"effect":0,"times":4,"speed":10,"w":192,"h":48,"x":0,"y":48},
        {"img":"./images/attacks/club/all.png","bullet":"left","bulletSpeed":2,"effect":0,"times":4,"speed":10,"w":192,"h":48,"x":-48,"y":0},
        {"img":"./images/attacks/club/all.png","bullet":"right","bulletSpeed":2,"effect":0,"times":4,"speed":10,"w":192,"h":48,"x":48,"y":0},
    ]},
    {"name":"attack.11.name","base":1,"cooldown":0.4,"img":"./images/attacks/dagger/icon.png", "anims":[
        {"img":"./images/attacks/bite/all.png","once":1,"times":4,"speed":20,"w":128,"h":32,"x":0,"y":-32},
        {"img":"./images/attacks/bite/all.png","once":1,"times":4,"speed":20,"w":128,"h":32,"x":0,"y":32},
        {"img":"./images/attacks/bite/all.png","once":1,"times":4,"speed":20,"w":128,"h":32,"x":-32,"y":0},
        {"img":"./images/attacks/bite/all.png","once":1,"times":4,"speed":20,"w":128,"h":32,"x":32,"y":0},
    ]},
    {"name":"attack.12.name","base":1,"cooldown":1,"range":8,"img":"./images/attacks/bow/icon.png", "anims":[
        {"img":"./images/attacks/knife/back.png","bullet":"top","bulletSpeed":4,"effect":0,"times":1,"speed":20,"w":14,"h":32,"x":0,"y":-288},
        {"img":"./images/attacks/knife/front.png","bullet":"down","bulletSpeed":4,"effect":0,"times":1,"speed":20,"w":14,"h":32,"x":0,"y":32},
        {"img":"./images/attacks/knife/left.png","bullet":"left","bulletSpeed":4,"effect":0,"times":1,"speed":20,"w":32,"h":14,"x":-288,"y":0},
        {"img":"./images/attacks/knife/right.png","bullet":"right","bulletSpeed":4,"effect":0,"times":1,"speed":20,"w":32,"h":14,"x":32,"y":0},
        {"img":"./images/attacks/knife/topright.png","bullet":"topright","bulletSpeed":4,"effect":0,"times":1,"speed":20,"w":32,"h":32,"x":0,"y":-288},
        {"img":"./images/attacks/knife/downright.png","bullet":"downright","bulletSpeed":4,"effect":0,"times":1,"speed":20,"w":32,"h":32,"x":0,"y":32},
        {"img":"./images/attacks/knife/topleft.png","bullet":"topleft","bulletSpeed":4,"effect":0,"times":1,"speed":20,"w":32,"h":32,"x":-288,"y":0},
        {"img":"./images/attacks/knife/downleft.png","bullet":"downleft","bulletSpeed":4,"effect":0,"times":1,"speed":20,"w":32,"h":32,"x":32,"y":0},
    ]},
    {"name":"attack.13.name","base":1,"cooldown":0.7,"img":"./images/attacks/rock/icon.png", "anims":[
        {"img":"./images/attacks/rock/back.png","once":1,"times":4,"speed":20,"w":160,"h":40,"x":4,"y":-32},
        {"img":"./images/attacks/rock/front.png","once":1,"times":4,"speed":20,"w":160,"h":40,"x":4,"y":32},
        {"img":"./images/attacks/rock/left.png","once":1,"times":4,"speed":20,"w":160,"h":40,"x":-32,"y":0},
        {"img":"./images/attacks/rock/right.png","once":1,"times":4,"speed":20,"w":160,"h":40,"x":24,"y":0},
    ]},
    {"name":"attack.14.name","base":1,"type":"magic","pool":1,"cooldown":1,"range":8,"img":"./images/attacks/staff/icon.png", "anims":[
        {"img":"./images/attacks/octo/all.png","bullet":"all","bulletSpeed":2,"effect":0,"times":4,"speed":5,"w":128,"h":32,"x":0,"y":0}
    ]},
    {"name":"attack.15.name","base":1,"type":"magic","cooldown":1.5,"range":5,"img":"./images/attacks/web/icon.png", "anims":[
        {"img":"./images/attacks/web/all.png","bullet":"all","bulletSpeed":2,"effect":0,"times":4,"speed":5,"w":128,"h":32,"x":0,"y":0}
    ]},
    {"name":"attack.16.name","base":1,"type":"magic","cooldown":1.5,"range":5,"img":"./images/attacks/web/icon.png", "anims":[
        {"img":"./images/attacks/fireball/all.png","bullet":"all","bulletSpeed":3,"effect":0,"times":4,"speed":7,"w":128,"h":32,"x":0,"y":0}
    ]},
    {"name":"attack.17.name","base":1,"cooldown":1.6,"range":9,"img":"./images/attacks/poison/icon.png", "anims":[
        {"img":"./images/attacks/poison/back.png","bullet":"top","effect":0,"bulletSpeed":3,"poisonMove":1,"times":4,"speed":10,"w":384,"h":64,"x":0,"y":-48},
        {"img":"./images/attacks/poison/front.png","bullet":"down","effect":0,"bulletSpeed":3,"poisonMove":1,"times":4,"speed":10,"w":384,"h":64,"x":0,"y":48},
        {"img":"./images/attacks/poison/left.png","bullet":"left","effect":0,"bulletSpeed":3,"poisonMove":1,"times":4,"speed":10,"w":256,"h":96,"x":-48,"y":0},
        {"img":"./images/attacks/poison/right.png","bullet":"right","effect":0,"bulletSpeed":3,"poisonMove":1,"times":4,"speed":10,"w":256,"h":96,"x":48,"y":0},
    ]},
    {"name":"attack.18.name","base":1,"type":"magic","cooldown":1.5,"range":5,"img":"./images/attacks/web/icon.png", "anims":[
        {"img":"./images/attacks/cold/all.png","once":1,"times":4,"speed":7,"w":640,"h":160,"x":0,"y":0}
    ]},
    {"name":"attack.19.name","base":1,"cooldown":0.7,"img":"./images/attacks/sword/icon.png", "anims":[
    {"img":"./images/attacks/swordHound/back.png","once":1,"times":4,"speed":15,"w":128,"h":48,"x":0,"y":-48},
    {"img":"./images/attacks/swordHound/front.png","once":1,"times":4,"speed":15,"w":128,"h":48,"x":0,"y":48},
    {"img":"./images/attacks/swordHound/left.png","once":1,"times":4,"speed":15,"w":192,"h":32,"x":-48,"y":0},
    {"img":"./images/attacks/swordHound/right.png","once":1,"times":4,"speed":15,"w":192,"h":32,"x":48,"y":0},
    ]},
    {"name":"attack.20.name","base":1,"cooldown":1.2,"img":"./images/attacks/boss3attack/icon.png", "anims":[
        {"img":"./images/attacks/boss3attack/back.png","once":1,"times":4,"speed":15,"w":512,"h":312,"x":0,"y":-128},
        {"img":"./images/attacks/boss3attack/front.png","once":1,"times":4,"speed":15,"w":512,"h":312,"x":0,"y":128},
        {"img":"./images/attacks/boss3attack/left.png","once":1,"times":4,"speed":15,"w":1248,"h":128,"x":-128,"y":0},
        {"img":"./images/attacks/boss3attack/right.png","once":1,"times":4,"speed":15,"w":1248,"h":128,"x":128,"y":0},
    ]},
    {"name":"attack.21.name","base":1,"cooldown":1.6,"range":9,"img":"./images/attacks/void/icon.png", "anims":[
        {"img":"./images/attacks/void/all.png","bullet":"top","effect":0,"bulletSpeed":3,"times":4,"speed":10,"w":384,"h":96,"x":0,"y":-48},
        {"img":"./images/attacks/void/all.png","bullet":"down","effect":0,"bulletSpeed":3,"times":4,"speed":10,"w":384,"h":96,"x":0,"y":48},
        {"img":"./images/attacks/void/all.png","bullet":"left","effect":0,"bulletSpeed":3,"times":4,"speed":10,"w":384,"h":96,"x":-48,"y":0},
        {"img":"./images/attacks/void/all.png","bullet":"right","effect":0,"bulletSpeed":3,"times":4,"speed":10,"w":384,"h":96,"x":48,"y":0},
    ]},
    //V85: уменьшенные копии «Звезды пустоты» (21) для осколков Медузы пустоты
    //(segmentation): 22 — мини-осколки (×0.5), 23 — микро-осколки (×0.25);
    //урон/кулдаун/дальность те же — меньше только визуал (решение пользователя)
    {"name":"attack.22.name","base":1,"cooldown":1.6,"range":9,"img":"./images/attacks/void/icon.png", "anims":[
        {"img":"./images/attacks/void/all.png","bullet":"top","effect":0,"bulletSpeed":4,"times":4,"speed":10,"w":192,"h":48,"x":0,"y":-24},
        {"img":"./images/attacks/void/all.png","bullet":"down","effect":0,"bulletSpeed":4,"times":4,"speed":10,"w":192,"h":48,"x":0,"y":24},
        {"img":"./images/attacks/void/all.png","bullet":"left","effect":0,"bulletSpeed":4,"times":4,"speed":10,"w":192,"h":48,"x":-24,"y":0},
        {"img":"./images/attacks/void/all.png","bullet":"right","effect":0,"bulletSpeed":4,"times":4,"speed":10,"w":192,"h":48,"x":24,"y":0},
    ]},
    {"name":"attack.23.name","base":1,"cooldown":1.6,"range":9,"img":"./images/attacks/void/icon.png", "anims":[
        {"img":"./images/attacks/void/all.png","bullet":"top","effect":0,"bulletSpeed":5,"times":4,"speed":10,"w":96,"h":24,"x":0,"y":-12},
        {"img":"./images/attacks/void/all.png","bullet":"down","effect":0,"bulletSpeed":5,"times":4,"speed":10,"w":96,"h":24,"x":0,"y":12},
        {"img":"./images/attacks/void/all.png","bullet":"left","effect":0,"bulletSpeed":5,"times":4,"speed":10,"w":96,"h":24,"x":-12,"y":0},
        {"img":"./images/attacks/void/all.png","bullet":"right","effect":0,"bulletSpeed":5,"times":4,"speed":10,"w":96,"h":24,"x":12,"y":0},
    ]},
    //E-15: мини-копия «Звезды пустоты» для мини-грибов Гриба пустоты — спрайт ×0.2 от 21
    //(по принципу осколков Медузы: 22 ×0.5, 23 ×0.25; 76/384 = 19/96 — кадр 19×19 ровный);
    //урон считается по stats.dmg стрелка, перенаправление — в spawnSporeMini (voidBoss.js)
    {"name":"attack.24.name","base":1,"cooldown":1.6,"range":9,"img":"./images/attacks/void/icon.png", "anims":[
        {"img":"./images/attacks/void/all.png","bullet":"top","effect":0,"bulletSpeed":5,"times":4,"speed":10,"w":76,"h":19,"x":0,"y":-10},
        {"img":"./images/attacks/void/all.png","bullet":"down","effect":0,"bulletSpeed":5,"times":4,"speed":10,"w":76,"h":19,"x":0,"y":10},
        {"img":"./images/attacks/void/all.png","bullet":"left","effect":0,"bulletSpeed":5,"times":4,"speed":10,"w":76,"h":19,"x":-10,"y":0},
        {"img":"./images/attacks/void/all.png","bullet":"right","effect":0,"bulletSpeed":5,"times":4,"speed":10,"w":76,"h":19,"x":10,"y":0},
    ]},
],
"effects":[
    {"img":"./images/effects/0.png","once":1,"times":4,"speed":10,"w":96,"h":24,"x":0,"y":0},
    {"img":"./images/effects/1.png","once":1,"times":4,"speed":10,"w":160,"h":40,"x":0,"y":0},
    {"img":"./images/effects/2.png","once":1,"times":4,"speed":10,"w":256,"h":64,"x":0,"y":0},
    {"img":"./images/effects/3.png","once":1,"times":4,"speed":10,"w":160,"h":40,"x":0,"y":0},
    {"img":"./images/effects/4.png","once":1,"times":4,"speed":10,"w":128,"h":32,"x":0,"y":0},
    {"img":"./images/effects/5.png","once":1,"times":7,"speed":8,"w":490,"h":70,"x":0,"y":0},
    {"img":"./images/effects/6.png","once":1,"times":4,"speed":8,"w":280,"h":70,"x":0,"y":19},
    {"img":"./images/effects/7.png","once":1,"times":4,"speed":10,"w":384,"h":96,"x":0,"y":19},
    {"img":"./images/effects/8.png","once":1,"times":4,"speed":3,"w":128,"h":37,"x":0,"y":15},
    {"img":"./images/effects/9.png","once":1,"times":4,"speed":4,"w":128,"h":56,"x":0,"y":-4},
    {"img":"./images/effects/10.png","once":1,"times":4,"speed":4,"w":128,"h":36,"x":0,"y":0},
    {"img":"./images/effects/11.png","times":1,"speed":4,"w":32,"h":17,"x":0,"y":20},
    {"img":"./images/effects/12.png","times":1,"speed":4,"w":64,"h":66,"x":0,"y":0},
    {"img":"./images/effects/13.png","once":1,"times":4,"speed":4,"w":512,"h":84,"x":0,"y":-32},
    {"img":"./images/effects/14.png","once":1,"times":4,"speed":4,"w":384,"h":97,"x":0,"y":0},
    {"img":"./images/effects/15.png","once":1,"times":6,"speed":1,"w":192,"h":42,"x":0,"y":0},
    {"img":"./images/effects/16.png","once":1,"times":4,"speed":10,"w":256,"h":64,"x":0,"y":0},
    //V63: облако кислоты (выпускает кислотная ловушка, trapsFx.releaseCloud): лист 384×96 =
    //4 кадра 96×96; speed 3.75 → animInterval округляет до 16 тиков на кадр ×4 ≈ 1с жизни.
    //Рисуется от ЦЕНТРА rect клетки ловушки (x/y = 0 → спрайт 96×96 со сдвигом −32,−32).
    {"img":"./images/effects/cloudAcid.png","once":1,"times":4,"speed":3.75,"w":384,"h":96,"x":0,"y":0}
],
"basicWeapons":[
    {"title":"weapon.0.title","damage":1,"attack":0,"rarity":0,"types":[11,12],"type":{"desc1":"weapon.0.desc1","desc2":"weapon.0.desc2"},"img":"./images/items/0.png","desc":"weapon.0.desc"},
    {"title":"weapon.1.title","damage":1,"attack":1,"rarity":0,"types":[11,12],"type":{"desc1":"weapon.1.desc1","desc2":"weapon.1.desc2"},"img":"./images/items/3.png","desc":"weapon.1.desc"},
    {"title":"weapon.2.title","damage":1,"attack":2,"rarity":0,"types":[11,12],"type":{"desc1":"weapon.2.desc1","desc2":"weapon.2.desc2"},"img":"./images/items/4.png","desc":"weapon.2.desc"},
    {"title":"weapon.3.title","damage":2,"attack":3,"rarity":0,"types":[11,12],"type":{"desc1":"weapon.3.desc1","desc2":"weapon.3.desc2"},"img":"./images/items/5.png","desc":"weapon.3.desc"},
    {"title":"weapon.4.title","damage":1,"attack":4,"rarity":0,"types":[11,12],"type":{"desc1":"weapon.4.desc1","desc2":"weapon.4.desc2"},"img":"./images/items/6.png","desc":"weapon.4.desc"},
    {"title":"weapon.5.title","damage":1,"attack":5,"rarity":0,"types":[11,12],"type":{"desc1":"weapon.5.desc1","desc2":"weapon.5.desc2"},"img":"./images/items/9.png","desc":"weapon.5.desc"},
    {"title":"weapon.6.title","damage":1,"attack":6,"rarity":0,"types":[11,12],"type":{"desc1":"weapon.6.desc1","desc2":"weapon.6.desc2"},"img":"./images/items/11.png","desc":"weapon.6.desc"},
    {"title":"weapon.7.title","damage":2,"attack":7,"rarity":0,"types":[11,12],"type":{"desc1":"weapon.7.desc1","desc2":"weapon.7.desc2"},"img":"./images/items/1.png","desc":"weapon.7.desc"},
    {"title":"weapon.8.title","damage":1,"attack":8,"rarity":0,"types":[11,12],"type":{"desc1":"weapon.8.desc1","desc2":"weapon.8.desc2"},"img":"./images/items/2.png","desc":"weapon.8.desc"},
    {"title":"weapon.9.title","damage":2,"attack":9,"rarity":0,"types":[11,12],"type":{"desc1":"weapon.9.desc1","desc2":"weapon.9.desc2"},"img":"./images/items/7.png","desc":"weapon.9.desc"},
    {"title":"weapon.10.title","rarity":0,"types":[12],"type":{"desc1":"","desc2":"weapon.10.desc2"},"img":"./images/items/13.png","desc":"weapon.10.desc","stat":6,"statCount":1},
    {"title":"weapon.11.title","rarity":0,"types":[12],"type":{"desc1":"","desc2":"weapon.11.desc2"},"img":"./images/items/14.png","desc":"weapon.11.desc","stat":6,"statCount":1},
]
}
//V48: раздел «Объекты» Библиотеки — интерактивные объекты карты (useObject.js). id = тип + этаж*20
//(формула спрайта createRoom: ./images/dungeon/objects/{id}.png; w/h — размер отрисовки, клетки*32).
//Решения пользователя: ловушки и столб призыва включены. V63: ловушек три (шипы 14 / кислота 34 /
//огонь 54 — спрайт от этажа не зависит, у столбов своя секция ниже), столб — id 55 (только 3-й
//этаж, fin1.png). Разблокировка карточки — первое использование объекта (useObject.js), зачёт
//между забегами живёт в meta.libraryObjects. Имена/описания составлены по фактическому эффекту.
//V49: статуя неизвестного героя (тип 16) — id 16/36/56 при спрайтах 14/34/54.png; бафы
//складываются; массив зачёта расширен до 57 слотов (normMeta добивает старые сейвы).
const OBJ_TYPES = [
    [1, "obj.1.name", 32, 64, "obj.1.desc"],
    [2, "obj.2.name", 64, 64, "obj.2.desc"],
    [3, "obj.3.name", 96, 96, "obj.3.desc"],
    [4, "obj.4.name", 32, 64, "obj.4.desc"],
    [5, "obj.5.name", 32, 32, "obj.5.desc"],
    [6, "obj.6.name", 96, 96, "obj.6.desc"],
    [7, "obj.7.name", 64, 64, "obj.7.desc"],
    [8, "obj.8.name", 32, 32, "obj.8.desc"],
    [9, "obj.9.name", 64, 64, "obj.9.desc"],
    [10, "obj.10.name", 96, 64, "obj.10.desc"],
    [11, "obj.11.name", 96, 96, "obj.11.desc"],
    [12, "obj.12.name", 96, 64, "obj.12.desc"],
    [13, "obj.13.name", 64, 64, "obj.13.desc"],
    //V49: высота статуи подставляется по этажам (натуральные 65/69/48) в сборщике ниже
    [16, "obj.16.name", 32, 69, "obj.16.desc"],
    //V54: алхимический стол (тип 17) — спрайты по этажам objects/15|35|55.png в сборщике ниже
    [17, "obj.17.name", 64, 64, "obj.17.desc"]
]
const ROMAN = [" I", " II", " III"]
data.objectsLib = []
for (let f = 0; f < 3; f++) {
    for (let i = 0; i < OBJ_TYPES.length; i++) {
        let t = OBJ_TYPES[i]
        //V49: статуя (тип 16) — спрайты по этажам лежат в objects/14|34|54.png (пути юзера),
        //высота карточки — натуральная высота спрайта этажа
        //V54: алхимический стол (тип 17) — objects/15|35|55.png (пути юзера)
        let statH = t[0] === 16 ? [65,69,48][f] : t[3]
        data.objectsLib.push({"id": t[0] + f * 20, "name": "obj." + t[0] + ".name", "rom": ROMAN[f], "w": t[2], "h": statH, "desc": "obj." + t[0] + ".desc", "img": "./images/dungeon/objects/" + (t[0] === 16 ? 14 + f * 20 : t[0] === 17 ? 15 + f * 20 : t[0] + f * 20) + ".png"})
    }
}
//ловушки — ТРИ карточки (V63, решение пользователя «разными карточками»): шипастая id 14
//(спрайт traps/3.png), кислотная id 34 (traps/4.png), огненная id 54 (traps/1.png, только
//3-й этаж); id = тип + этаж*20, как у остальных объектов (81 слот normMeta вмещает).
//Столб призыва — только 3-й этаж (отрисовка 32×81)
data.objectsLib.push({"id": 14, "name": "obj.14.name", "w": 32, "h": 32, "desc": "obj.14.desc", "img": "./images/dungeon/traps/3.png"})
data.objectsLib.push({"id": 34, "name": "obj.34.name", "w": 32, "h": 32, "desc": "obj.34.desc", "img": "./images/dungeon/traps/4.png"})
data.objectsLib.push({"id": 54, "name": "obj.54.name", "w": 32, "h": 32, "desc": "obj.54.desc", "img": "./images/dungeon/traps/1.png"})
data.objectsLib.push({"id": 55, "name": "obj.55.name", "w": 32, "h": 81, "desc": "obj.55.desc", "img": "./images/dungeon/objects/fin1.png"})
//V75: шкафчик с древностями (тип 20) — один спрайт 101.png на ВСЕ этажи (как портал/рычаг),
//карточка на каждый этаж: id = 20 + этаж*20 → 20/40/60/80; натуральный размер спрайта 64×42
for (let f = 0; f < 4; f++) {
    data.objectsLib.push({"id": 20 + f * 20, "name": "obj.20.name", "rom": ROMAN[f] || " IV", "w": 64, "h": 42, "desc": "obj.20.desc", "img": "./images/dungeon/objects/101.png"})
}
export {data}
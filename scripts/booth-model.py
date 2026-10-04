"""Dimensioned concept, centimetres. Run with Blender --background --python.
Component bodies are envelopes, not manufacturing CAD or an optical simulation.
"""
import bpy, math
from mathutils import Vector
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'docs' / 'booth-layout'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'; scene.unit_settings.scale_length = .01
scene.render.engine = 'CYCLES'; scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 1400; scene.render.resolution_y = 1100; scene.render.resolution_percentage = 100
scene.world.color = (.45, .45, .45)
scene.view_settings.view_transform = 'AgX'

def material(name, color, metallic=0, rough=.7):
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic; p.inputs['Roughness'].default_value = rough
    return m
card = material('Cardboard exterior', (.45,.30,.17))
wood = material('Rigid internal support', (.66,.52,.34))
black = material('Camera and light baffles', (.025,.03,.025))
white = material('White diffusion / reflective chamber', (.92,.9,.82))
silver = material('Closed Mac placeholder', (.44,.48,.47), .65, .35)
screen = material('Guest display', (.055,.09,.075))
lime = material('Button', (.64,.85,.29))
glass = material('Lens glass', (.016,.035,.04), .45, .18)
floor = material('Background', (.81,.80,.75))
front = []

def cube(name, xyz, dims, mat, bevel=.12):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz); ob = bpy.context.object; ob.name = name; ob.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    if bevel:
        mod = ob.modifiers.new('Soft edges','BEVEL'); mod.width = bevel; mod.segments = 3
        ob.modifiers.new('Normals','WEIGHTED_NORMAL')
    return ob

def cyl(name, xyz, radius, depth, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=radius, depth=depth, location=xyz, rotation=(math.pi/2,0,0))
    ob=bpy.context.object; ob.name=name; ob.data.materials.append(mat)
    mod=ob.modifiers.new('Edge','BEVEL'); mod.width=.08; mod.segments=3
    ob.modifiers.new('Normals','WEIGHTED_NORMAL'); return ob

def text(name, value, xyz, size, mat, align='CENTER'):
    curve=bpy.data.curves.new(name, 'FONT'); curve.body=value; curve.align_x=align; curve.size=size; curve.extrude=.002
    ob=bpy.data.objects.new(name, curve); bpy.context.collection.objects.link(ob); ob.location=xyz; ob.rotation_euler=(math.pi/2,0,0); curve.materials.append(mat); return ob

# The outer faces span exactly 47 x 36 x 22.5 cm. The lens protrudes ~1 cm.
cube('Rigid base (inside cardboard)', (0,11.25,.65), (46.2,21.7,.5), wood)
cube('Cardboard base', (0,11.25,.2), (47,22.5,.4), card)
left=cube('Left wall',(-23.3,11.25,18),(.4,22.5,36),card)
right=cube('Right wall',(23.3,11.25,18),(.4,22.5,36),card)
back=cube('Removable rear', (0,22.3,18),(47,.4,36),card)
top=cube('Removable top', (0,11.25,35.8),(47,22.5,.4),card)

# Ventilation openings in the electronics compartment and rear top strip.
for wall, x in [(left,-23.3),(right,23.3)]:
    for z in [4,6,8,10]:
        slot=cube('Temporary vent',(x,13,z),(1.5,11,.7),black,0)
        mod=wall.modifiers.new('Vent','BOOLEAN'); mod.object=slot
        bpy.context.view_layer.objects.active=wall; bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(slot,do_unlink=True)
for y in [19,20.2,21.4]:
    slot=cube('Temporary top vent',(0,y,35.8),(28,.6,1.5),black,0)
    mod=top.modifiers.new('Rear ventilation','BOOLEAN'); mod.object=slot
    bpy.context.view_layer.objects.active=top; bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(slot,do_unlink=True)

for x in [-22.2,22.2]:
    for y in [1.5,21]: cube('Internal frame upright',(x,y,18),(1,1,34.8),wood)

# Face made from non-overlapping strips around actual panel openings.
front += [cube('Face bottom', (0,0,1),(47,.5,2),card), cube('Face top',(0,0,35),(47,.5,2),card)]
front += [cube('Face camera surround',(0,0,26),(15,.5,16),card), cube('Face middle rail',(0,0,17.5),(47,.5,1),card)]
front += [cube('Face left lower',(-19.25,0,9.5),(8.5,.5,15),card), cube('Face right lower',(16.25,0,9.5),(14.5,.5,15),card)]
for x in [-22.5,22.5]: front.append(cube('Face edge',(x,0,26),(2,.5,16),card))
for x, side in [(-14.5,'A'),(14.5,'B')]:
    front.append(cube('Diffusion '+side,(x,-.31,26),(14,.08,16),white,.03))
    # Vertical baffles separate the lens and electronics from the light path.
    cube('Inner baffle '+side,(-7.7 if x<0 else 7.7,8.8,26),(.25,17.6,16),black)
    cube('White chamber rear '+side,(x,17.7,26),(14,.25,16),white)
    cube('Light shelf '+side,(x,10,17.3),(14,17,.4),wood)
    cube('430EX II '+side+' body',(x,8,23),(5.5,4,8),black,.35)
    cube('430EX II '+side+' head (bounce direction to rear)',(x,9.5,29),(7.2,10.1,4.2),black,.45)
    cube('Flash head glass '+side,(x,14.58,29),(6.4,.08,2.8),white,.08)
    cube('Radio receiver allowance '+side,(x,8,18.5),(6,7,2),black)

# Lens opening: camera surround gets a Boolean aperture.
face=bpy.data.objects['Face camera surround']
hole=cyl('Temporary aperture',(0,0,26.5),3.75,2,black)
mod=face.modifiers.new('Lens opening','BOOLEAN'); mod.object=hole
bpy.context.view_layer.objects.active=face; bpy.ops.object.modifier_apply(modifier=mod.name); bpy.data.objects.remove(hole,do_unlink=True)
cube('Canon EOS RP body envelope',(0,5.5,26.5),(13.25,7,8.5),black,.5)
cube('Camera mounting shelf',(0,7,21.5),(14,13,.6),wood)
cyl('RF 28mm f2.8 barrel',(0,.8,26.5),3.46,2.47,black)
cyl('RF 28mm front',(0,-.48,26.5),2.65,.15,glass)
front.append(text('Camera label','RP / 28',(0,-.42,21),.8,white))

# A not-yet-purchased display. Its 24 x 15 cm outer envelope is an assumption.
front.append(cube('10 inch display allowance',(-3,-.3,9.5),(24,.7,15),black,.3))
front.append(cube('Display glass',(-3,-.7,9.5),(22.5,.05,13.4),screen,.12))
front.append(text('Screen title','Photobooth.',(-3,-.75,10),2.3,white))
front.append(text('Screen caption','FIND YOUR FRAME',(-3,-.75,7),.58,white))
front.append(cyl('USB capture button',(-19.4,-.5,8),1.45,.8,lime))
front.append(text('Button label','CAPTURE',(-19.4,-.45,4.7),.55,white))
front.append(cube('Optional Ace 25x LED',(16.4,.7,8.8),(11.8,3.3,7.7),black,.4))
front.append(cube('Optional LED diffuser',(16.4,-1,8.8),(10.8,.15,6.5),white,.15))
front.append(text('Edition','FRAME / 001',(0,-.35,.65),.7,white))

# Rear slot is a placeholder, not a claim about a particular MacBook model.
cube('Closed MacBook ALLOWANCE 34 x 24 x 2',(0,20,14),(34,2,24),silver,.3)
for x in [-13,13]: cube('Mac cradle',(x,20,1.6),(3,3,1.5),black)
cube('Power and cable allowance',(0,10,4),(20,8,5),silver)
cube('Off-camera transmitter allowance',(-19,8,4),(7,7,5.5),black)

cube('Ground',(0,0,-1),(300,300,1),floor)
def point_at(ob, target): ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
for name,xyz,energy,size in [('Key',(-40,-50,85),100000,70),('Fill',(50,-10,60),60000,60),('Rear',(0,70,90),100000,50)]:
    bpy.ops.object.light_add(type='AREA', location=xyz); ob=bpy.context.object; ob.name=name; ob.data.energy=energy; ob.data.shape='DISK'; ob.data.size=size; point_at(ob,(0,10,16))
bpy.ops.object.camera_add(location=(65,-95,62)); camera=bpy.context.object; camera.name='Presentation camera'; camera.data.type='ORTHO'; camera.data.ortho_scale=76; point_at(camera,(0,8,17)); scene.camera=camera
scene.render.filepath=str(OUT/'booth-front.png'); bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'portrait-box.blend')); bpy.ops.render.render(write_still=True)

# Exploded cover and transparent access via removing top/right/rear from render.
for ob in front: ob.location.y -= 17
for ob in [top,right,back]: ob.hide_render=True; ob.hide_set(True)
camera.location=(70,-85,80); camera.data.ortho_scale=89; point_at(camera,(0,2,16))
scene.render.filepath=str(OUT/'booth-cutaway.png'); bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'portrait-box-exploded.blend')); bpy.ops.render.render(write_still=True)

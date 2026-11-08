"""User-approved cutout and black-ink recolor. Requires Pillow and NumPy."""
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np, json, shutil
ROOT=Path(__file__).resolve().parents[1]; brand=ROOT/'mobile/assets/brand'; preview=ROOT/'.local/brand15'; preview.mkdir(parents=True,exist_ok=True)

def extract(name):
    original=Image.open(brand/f'remarked-{name}.jpg').convert('RGB')
    rgb=np.asarray(original).astype(float)
    border=np.concatenate([rgb[:30].reshape(-1,3),rgb[-30:].reshape(-1,3),rgb[:,:30].reshape(-1,3),rgb[:,-30:].reshape(-1,3)])
    bg=np.median(border,axis=0)
    white=np.clip(np.min((rgb-bg)/(253-bg),axis=2),0,1)
    green=np.clip((rgb[:,:,1]-rgb[:,:,0]-(bg[1]-bg[0]))/160,0,1)
    alpha=np.maximum(white,green)
    alpha=np.clip((alpha-.04)/.96,0,1)
    interior=Image.fromarray(np.uint8(alpha>.5)*255).filter(ImageFilter.MinFilter(5))
    alpha[np.asarray(interior)>0]=1
    # Remove the original charcoal contribution only at antialiased edges.
    foreground=np.clip((rgb-bg[None,None,:]*(1-alpha[:,:,None]))/np.maximum(alpha[:,:,None],1/255),0,255)
    foreground[alpha==0]=0
    rgba=np.dstack([foreground,np.rint(alpha*255)]).astype('uint8')
    cutout=Image.fromarray(rgba,'RGBA')
    box=cutout.getchannel('A').getbbox()
    box=(max(0,box[0]-8),max(0,box[1]-8),min(cutout.width,box[2]+8),min(cutout.height,box[3]+8))
    cutout=cutout.crop(box)
    # Dark reflection cards retain the original light-ink contrast variant.
    if name=='wordmark':
        cutout.save(ROOT/'mobile/public/brand/remarked-wordmark-light.png',optimize=True)
    pixels=np.array(cutout)
    colors=pixels[:,:,:3].astype(int)
    green=(colors[:,:,1]-colors[:,:,0]>20)&(colors[:,:,1]-colors[:,:,2]>12)
    # Preserve the supplied green gradient and all alpha/antialias coverage.
    pixels[~green,:3]=0
    cutout=Image.fromarray(pixels,'RGBA')
    cutout.save(brand/f'remarked-{name}-transparent.png',optimize=True)
    for bgname,color in [('paper','#fdf9f3'),('dark','#1c1e1d')]:
        base=Image.new('RGBA',cutout.size,color);base.alpha_composite(cutout)
        base.convert('RGB').save(preview/f'{name}-{bgname}.jpg',quality=95)
    print(json.dumps({'asset':name,'size':cutout.size,'alphaRange':cutout.getchannel('A').getextrema(),'backgroundRemoved':True}))
    return cutout
wordmark=extract('wordmark'); mark=extract('mark')
layout=dict(x=0,y=0,width=wordmark.width,height=wordmark.height,imageWidth=wordmark.width,imageHeight=wordmark.height)
(brand/'wordmark-layout.json').write_text(json.dumps(layout,indent=2)+'\n')
shutil.copy2(brand/'remarked-wordmark-transparent.png',ROOT/'mobile/public/brand/remarked-wordmark-transparent.png')

# Preserve the cutout's shape; use a light opaque canvas where app icons need one.
def icon(size,padding=.19,opaque=True):
    result=Image.new('RGBA',(size,size),'#fdf9f3' if opaque else (0,0,0,0))
    fitted=mark.copy();fitted.thumbnail((round(size*(1-2*padding)),round(size*(1-2*padding))),Image.Resampling.LANCZOS)
    pos=((size-fitted.width)//2,(size-fitted.height)//2)
    result.alpha_composite(fitted,pos)
    return result.convert('RGB') if opaque else result
assets=ROOT/'mobile/assets'; public=ROOT/'mobile/public/icons'
icon(1024).save(assets/'icon.png'); icon(1024,.25,False).save(assets/'android-icon-foreground.png');icon(1024).save(assets/'splash-icon.png');icon(48,.1).save(assets/'favicon.png')
for size,name,pad in [(192,'remarked-v15-192.png',.19),(512,'remarked-v15-512.png',.19),(512,'remarked-v15-maskable-512.png',.25),(180,'remarked-v15-apple-touch.png',.19),(48,'remarked-v15-favicon.png',.1)]:
    icon(size,pad).save(public/name)
icon(512).save(preview/'app-icon.png')

# Keep unversioned icon paths working while new manifests use v15 URLs.
for current in public.glob('remarked-v15-*.png'):
    shutil.copy2(current,public/current.name.replace('remarked-v15-','remarked-'))
for target,source in [('icon-512.png','remarked-v15-512.png'),('icon-192.png','remarked-v15-192.png'),('apple-touch-icon.png','remarked-v15-apple-touch.png')]:
    shutil.copy2(public/source,public/target)

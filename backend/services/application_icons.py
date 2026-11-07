"""Copy native executable icons into a local cache. No generated substitutes."""
import ctypes as ct
import hashlib
from pathlib import Path
import struct
import zlib

ICON_DIRECTORY = Path(__file__).resolve().parents[2] / 'frontend/assets/audio/apps'


class BitmapHeader(ct.Structure):
    _fields_ = [('size',ct.c_uint32),('width',ct.c_int32),('height',ct.c_int32),
                ('planes',ct.c_uint16),('bits',ct.c_uint16),('compression',ct.c_uint32),
                ('image_size',ct.c_uint32),('xppm',ct.c_int32),('yppm',ct.c_int32),
                ('colors',ct.c_uint32),('important',ct.c_uint32)]


class IconInfo(ct.Structure):
    _fields_ = [('is_icon',ct.c_int),('x',ct.c_uint32),('y',ct.c_uint32),
                ('mask',ct.c_void_p),('color',ct.c_void_p)]


def _png(width, height, rgba):
    def chunk(kind, data):
        return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
    rows=b''.join(b'\0'+rgba[y*width*4:(y+1)*width*4] for y in range(height))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')


def extract_executable_icon(filename, size=64):
    user=ct.WinDLL('user32',use_last_error=True);gdi=ct.WinDLL('gdi32',use_last_error=True)
    user.PrivateExtractIconsW.argtypes=[ct.c_wchar_p,ct.c_int,ct.c_int,ct.c_int,ct.POINTER(ct.c_void_p),ct.POINTER(ct.c_uint),ct.c_uint,ct.c_uint]
    user.PrivateExtractIconsW.restype=ct.c_uint
    user.DestroyIcon.argtypes=[ct.c_void_p]
    user.DrawIconEx.argtypes=[ct.c_void_p,ct.c_int,ct.c_int,ct.c_void_p,ct.c_int,ct.c_int,ct.c_uint,ct.c_void_p,ct.c_uint]
    user.GetIconInfo.argtypes=[ct.c_void_p,ct.POINTER(IconInfo)]
    gdi.CreateCompatibleDC.argtypes=[ct.c_void_p];gdi.CreateCompatibleDC.restype=ct.c_void_p
    gdi.CreateDIBSection.argtypes=[ct.c_void_p,ct.c_void_p,ct.c_uint,ct.POINTER(ct.c_void_p),ct.c_void_p,ct.c_uint];gdi.CreateDIBSection.restype=ct.c_void_p
    gdi.SelectObject.argtypes=[ct.c_void_p,ct.c_void_p];gdi.SelectObject.restype=ct.c_void_p
    gdi.DeleteObject.argtypes=[ct.c_void_p];gdi.DeleteDC.argtypes=[ct.c_void_p]
    gdi.GetDIBits.argtypes=[ct.c_void_p,ct.c_void_p,ct.c_uint,ct.c_uint,ct.c_void_p,ct.c_void_p,ct.c_uint]
    icon=ct.c_void_p();resource=ct.c_uint();dc=bitmap=previous=None
    try:
        count=user.PrivateExtractIconsW(str(filename),0,size,size,ct.byref(icon),ct.byref(resource),1,0)
        if count in (0,0xffffffff) or not icon.value: raise OSError('Executable has no readable icon resource')
        dc=gdi.CreateCompatibleDC(None)
        header=BitmapHeader(ct.sizeof(BitmapHeader),size,-size,1,32,0,size*size*4,0,0,0,0)
        pixels=ct.c_void_p();bitmap=gdi.CreateDIBSection(dc,ct.byref(header),0,ct.byref(pixels),None,0)
        if not dc or not bitmap or not pixels.value: raise OSError('Icon bitmap unavailable')
        previous=gdi.SelectObject(dc,bitmap);ct.memset(pixels,0,size*size*4)
        if not user.DrawIconEx(dc,0,0,icon,size,size,0,None,3): raise OSError('Cannot draw native icon')
        raw=ct.string_at(pixels,size*size*4);mask=None
        if not any(raw[3::4]):
            info=IconInfo()
            if not user.GetIconInfo(icon,ct.byref(info)): raise OSError('Icon transparency unavailable')
            try:
                data=ct.create_string_buffer(size*size*4)
                if not gdi.GetDIBits(dc,info.mask,0,size,data,ct.byref(header),0): raise OSError('Icon mask unavailable')
                mask=data.raw
            finally:
                for handle in (info.mask,info.color):
                    if handle:gdi.DeleteObject(handle)
        rgba=bytearray()
        for i in range(0,len(raw),4):
            blue,green,red,alpha=raw[i:i+4]
            if mask is not None: alpha=0 if mask[i] else 255
            elif 0<alpha<255:
                red,green,blue=(min(255,round(value*255/alpha)) for value in (red,green,blue))
            rgba.extend((red,green,blue,alpha))
        return _png(size,size,rgba)
    finally:
        if previous and dc:gdi.SelectObject(dc,previous)
        if bitmap:gdi.DeleteObject(bitmap)
        if dc:gdi.DeleteDC(dc)
        if icon.value:user.DestroyIcon(icon)


class ApplicationIconCache:
    def __init__(self, directory=ICON_DIRECTORY, extractor=extract_executable_icon):
        self.directory=Path(directory);self.extractor=extractor;self.cache={}

    def get(self, executable_path):
        if not executable_path:return None
        try:
            path=Path(executable_path);stat=path.stat()
            key=(str(path).lower(),stat.st_mtime_ns,stat.st_size)
            if key not in self.cache:
                token=hashlib.sha256(repr(key).encode()).hexdigest()[:24]
                destination=self.directory/(token+'.png')
                if not destination.exists():
                    image=self.extractor(path)
                    self.directory.mkdir(parents=True,exist_ok=True)
                    temporary=destination.with_suffix('.tmp');temporary.write_bytes(image);temporary.replace(destination)
                self.cache[key]='/assets/audio/apps/'+destination.name
            return self.cache[key]
        except (OSError,ValueError):
            return None


def is_audio_observer(executable_path):
    """The installed SteelSeries visualizer observes the mix; it isn't its source."""
    normalized=str(executable_path).replace('\\','/').lower()
    return normalized.endswith('/steelseries/gg/apps/engine/engineapps/audiovisualizer/audiosync.exe')

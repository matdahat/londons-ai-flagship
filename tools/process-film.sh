#!/bin/bash
# Londons.ai — the flagship film pipeline.
# Locks the grade to pure B&W, joins the six clips into one descent,
# extracts the canvas frame sequence, and encodes compressed mobile loops.
set -euo pipefail

FILM="$(cd "$(dirname "$0")/../assets/film" && pwd)"
FRAMES="$(cd "$(dirname "$0")/../assets/frames" && pwd)"

FPS=8               # frames per second of the scrub sequence
W=1920              # frame width (16:9 -> 1080 high) — matches source resolution,
                    # avoids the desktop canvas upscaling a smaller frame
QUALITY=10          # mjpeg -q:v (2 best .. 31 worst)
N=6                 # number of clips

cd "$FILM"

# 1 — grade-lock each clip (saturation 0, slight contrast) at matched params
for i in $(seq 1 $N); do
  ffmpeg -y -v error -i "clip-$i.mp4" \
    -vf "hue=s=0,eq=contrast=1.04" \
    -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -an "graded-$i.mp4"
done

# 2 — concatenate into the single unbroken descent
INPUTS=""
FILTER_IN=""
for i in $(seq 1 $N); do
  INPUTS="$INPUTS -i graded-$i.mp4"
  FILTER_IN="${FILTER_IN}[$((i-1)):v]"
done
ffmpeg -y -v error $INPUTS \
  -filter_complex "${FILTER_IN}concat=n=$N:v=1:a=0[v]" \
  -map "[v]" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p descent.mp4

# 3 — canvas frame sequence + manifest (light denoise: grain fights jpeg)
find "$FRAMES" \( -name 'f-*.webp' -o -name 'f-*.jpg' \) -delete
ffmpeg -y -v error -i descent.mp4 \
  -vf "hqdn3d=3:2:6:4,fps=$FPS,scale=$W:-2" \
  -q:v $QUALITY -start_number 1 "$FRAMES/f-%04d.jpg"
COUNT=$(ls "$FRAMES" | grep -c '^f-.*\.jpg$')

# real zone boundaries — cumulative duration fractions after clips 1..5 (5 clips join at 6)
DURS=()
for i in $(seq 1 $N); do
  DURS+=("$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 graded-$i.mp4)")
done
ZONES=$(python3 -c "
d=[${DURS[0]},${DURS[1]},${DURS[2]},${DURS[3]},${DURS[4]},${DURS[5]}]
t=sum(d)
c=0.0
out=[]
for x in d[:-1]:
    c+=x
    out.append(round(c/t,4))
print('[' + ', '.join(str(v) for v in out) + ']')")
printf '{ "count": %s, "pad": 4, "fps": %s, "ext": ".jpg", "zones": %s }\n' \
  "$COUNT" "$FPS" "$ZONES" > "$FRAMES/manifest.json"

# 4 — compressed autoplay loops for mobile (720p, silent, faststart)
for i in $(seq 1 $N); do
  ffmpeg -y -v error -i "graded-$i.mp4" \
    -vf "scale=1280:-2" \
    -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p \
    -movflags +faststart -an "clip-$i-loop.mp4"
done

# 5 — the phone opening: a portrait crop of clip 1 from the 4K grade. The crop
#     pans left with the camera so Tower Bridge stays in frame the whole way.
#     864x1536 at crf 28 is ~2.7 MB, about what the old 720p landscape loop
#     weighed, at roughly twice the sharpness on a phone.
D1=$(ffprobe -v error -show_entries format=duration -of csv=p=0 graded-1.mp4)
ffmpeg -y -v error -i graded-1.mp4 \
  -vf "crop=w=1215:h=2160:x='(0.15-0.15*t/${D1})*in_w':y=0,scale=864:1536:flags=lanczos" \
  -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -profile:v high \
  -movflags +faststart -an hero-portrait-loop.mp4
ffmpeg -y -v error -i hero-portrait-loop.mp4 -frames:v 1 \
  -vf "scale=540:960:flags=lanczos" -q:v 5 hero-portrait-poster.jpg

echo "frames: $COUNT @ ${FPS}fps"
du -sh "$FRAMES" descent.mp4 clip-*-loop.mp4 hero-portrait-loop.mp4

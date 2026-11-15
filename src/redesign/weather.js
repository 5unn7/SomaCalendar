/* Live weather for the Today card: reads the forecast the native shell fetched from MET Norway (see Weather.java),
 * picks the hour that holds now, and draws the moving sky (rain, snow, wind, clouds, fog, lightning, sun, stars).
 * The same kinds, icons and layers as the home-screen Sky widget. Pure and ES2017, so tests can run it in Node.
 */
(function(root){
'use strict';
var SHOW_FOR=12*36e5, WINDY_MS=8;
/* ART:BEGIN */
var ICONS={"sun":"<path fill=\"#FFD36B\" fill-opacity=\"1\" d=\"M7.6,12a4.4,4.4 0 1,0 8.8,0a4.4,4.4 0 1,0 -8.8,0z\"/><path fill=\"none\" stroke=\"#FFD36B\" stroke-opacity=\"1\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M18.6,12L20.6,12M16.67,16.67L18.08,18.08M12,18.6L12,20.6M7.33,16.67L5.92,18.08M5.4,12L3.4,12M7.33,7.33L5.92,5.92M12,5.4L12,3.4M16.67,7.33L18.08,5.92\"/>",
"moon":"<path fill=\"#F4EEDF\" fill-opacity=\"1\" d=\"M14.2,3.2A8.8,8.8 0 1,0 20.8,14.6A7.1,7.1 0 0,1 14.2,3.2Z\"/>",
"partly_day":"<g transform=\"translate(-1.5 -2.5) scale(0.7)\"><path fill=\"#FFD36B\" fill-opacity=\"1\" d=\"M7.6,12a4.4,4.4 0 1,0 8.8,0a4.4,4.4 0 1,0 -8.8,0z\"/><path fill=\"none\" stroke=\"#FFD36B\" stroke-opacity=\"1\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M18.6,12L20.6,12M16.67,16.67L18.08,18.08M12,18.6L12,20.6M7.33,16.67L5.92,18.08M5.4,12L3.4,12M7.33,7.33L5.92,5.92M12,5.4L12,3.4M16.67,7.33L18.08,5.92\"/></g><g transform=\"translate(2.2 3.2) scale(0.86)\"><path fill=\"#FFFFFF\" fill-opacity=\"1\" d=\"M7,19.5A4.25,4.25 0 0,1 6.4,11.05A6,6 0 0,1 17.6,9.9A4.8,4.8 0 0,1 18.2,19.5Z\"/></g>",
"partly_night":"<g transform=\"translate(-0.5 -2.5) scale(0.62)\"><path fill=\"#F4EEDF\" fill-opacity=\"1\" d=\"M14.2,3.2A8.8,8.8 0 1,0 20.8,14.6A7.1,7.1 0 0,1 14.2,3.2Z\"/></g><g transform=\"translate(2.2 3.2) scale(0.86)\"><path fill=\"#FFFFFF\" fill-opacity=\"1\" d=\"M7,19.5A4.25,4.25 0 0,1 6.4,11.05A6,6 0 0,1 17.6,9.9A4.8,4.8 0 0,1 18.2,19.5Z\"/></g>",
"cloud":"<g transform=\"translate(-3 -4.2) scale(0.82)\"><path fill=\"#FFFFFF\" fill-opacity=\"0.55\" d=\"M7,19.5A4.25,4.25 0 0,1 6.4,11.05A6,6 0 0,1 17.6,9.9A4.8,4.8 0 0,1 18.2,19.5Z\"/></g><g transform=\"translate(1.2 1.6) scale(0.9)\"><path fill=\"#FFFFFF\" fill-opacity=\"1\" d=\"M7,19.5A4.25,4.25 0 0,1 6.4,11.05A6,6 0 0,1 17.6,9.9A4.8,4.8 0 0,1 18.2,19.5Z\"/></g>",
"fog":"<g transform=\"translate(0 -3.4) scale(1)\"><path fill=\"#FFFFFF\" fill-opacity=\"0.9\" d=\"M7,19.5A4.25,4.25 0 0,1 6.4,11.05A6,6 0 0,1 17.6,9.9A4.8,4.8 0 0,1 18.2,19.5Z\"/></g><path fill=\"none\" stroke=\"#FFFFFF\" stroke-opacity=\"0.8\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M4,19.5H20M6.5,22.4H17.5\"/>",
"drizzle":"<g transform=\"translate(0 -3.6) scale(1)\"><path fill=\"#FFFFFF\" fill-opacity=\"1\" d=\"M7,19.5A4.25,4.25 0 0,1 6.4,11.05A6,6 0 0,1 17.6,9.9A4.8,4.8 0 0,1 18.2,19.5Z\"/></g><path fill=\"#CFE6FF\" fill-opacity=\"1\" d=\"M7.5,20.4a1,1 0 1,0 2,0a1,1 0 1,0 -2,0zM11.5,21.8a1,1 0 1,0 2,0a1,1 0 1,0 -2,0zM15.5,20.4a1,1 0 1,0 2,0a1,1 0 1,0 -2,0z\"/>",
"rain":"<g transform=\"translate(0 -3.6) scale(1)\"><path fill=\"#FFFFFF\" fill-opacity=\"1\" d=\"M7,19.5A4.25,4.25 0 0,1 6.4,11.05A6,6 0 0,1 17.6,9.9A4.8,4.8 0 0,1 18.2,19.5Z\"/></g><path fill=\"none\" stroke=\"#CFE6FF\" stroke-opacity=\"1\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M8.6,18.6L7.4,22.4M12.6,18.6L11.4,22.4M16.6,18.6L15.4,22.4\"/>",
"snow":"<g transform=\"translate(0 -3.6) scale(1)\"><path fill=\"#FFFFFF\" fill-opacity=\"1\" d=\"M7,19.5A4.25,4.25 0 0,1 6.4,11.05A6,6 0 0,1 17.6,9.9A4.8,4.8 0 0,1 18.2,19.5Z\"/></g><path fill=\"#FFFFFF\" fill-opacity=\"1\" d=\"M6.85,19.6a1.15,1.15 0 1,0 2.3,0a1.15,1.15 0 1,0 -2.3,0zM10.85,21.9a1.15,1.15 0 1,0 2.3,0a1.15,1.15 0 1,0 -2.3,0zM14.85,19.6a1.15,1.15 0 1,0 2.3,0a1.15,1.15 0 1,0 -2.3,0zM9.2,23a0.8,0.8 0 1,0 1.6,0a0.8,0.8 0 1,0 -1.6,0zM13.6,23a0.8,0.8 0 1,0 1.6,0a0.8,0.8 0 1,0 -1.6,0z\"/>",
"sleet":"<g transform=\"translate(0 -3.6) scale(1)\"><path fill=\"#FFFFFF\" fill-opacity=\"1\" d=\"M7,19.5A4.25,4.25 0 0,1 6.4,11.05A6,6 0 0,1 17.6,9.9A4.8,4.8 0 0,1 18.2,19.5Z\"/></g><path fill=\"none\" stroke=\"#CFE6FF\" stroke-opacity=\"1\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M8.6,18.6L7.4,22.4M16.6,18.6L15.4,22.4\"/><path fill=\"#FFFFFF\" fill-opacity=\"1\" d=\"M10.85,20.8a1.15,1.15 0 1,0 2.3,0a1.15,1.15 0 1,0 -2.3,0z\"/>",
"thunder":"<g transform=\"translate(0 -3.6) scale(1)\"><path fill=\"#FFFFFF\" fill-opacity=\"1\" d=\"M7,19.5A4.25,4.25 0 0,1 6.4,11.05A6,6 0 0,1 17.6,9.9A4.8,4.8 0 0,1 18.2,19.5Z\"/></g><path fill=\"#FFD36B\" fill-opacity=\"1\" d=\"M12.8,16.2L9.4,21.2H11.9L10.9,24L14.8,18.6H12.2Z\"/>",
"wind":"<path fill=\"none\" stroke=\"#FFFFFF\" stroke-opacity=\"1\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M3,9.2H14.2A2.6,2.6 0 1,0 11.8,5.6M3,13H18.6A2.9,2.9 0 1,1 16,17.2M3,16.8H10.2\"/>"};
/* ART:END */

/* The forecast hour holding `now`, plus high and low for what is left of today (late at night: the next 24 hours). */
function at(data,now,dayEnd){
  var n={ok:false};
  if(!data||!data.hours||!data.hours.length)return n;
  now=+now;
  if(now-data.at>SHOW_FOR||now<data.at-36e5)return n;
  var hours=data.hours,i,idx=-1;
  for(i=0;i<hours.length;i++)if(hours[i].t<=now&&now<hours[i].t+36e5){idx=i;break;}
  if(idx<0)return n;
  var h=hours[idx],end=dayEnd-now<3*36e5?now+24*36e5:dayEnd,hi=h.c,lo=h.c;
  for(i=idx;i<hours.length&&hours[i].t<end;i++){hi=Math.max(hi,hours[i].c);lo=Math.min(lo,hours[i].c);}
  return {ok:true,temp:h.c,kind:h.k||'cloudy',wind:h.w||0,humidity:h.h||0,precip:h.p||0,windy:(h.w||0)>=WINDY_MS,hi:hi,lo:lo,next:hours.slice(idx+1,idx+13),fetched:data.at};
}
/* Which layers the weather calls for and how strong each is (0..1). Mirrors PanchangWidgets.effects(). */
function effects(kind,day,windy){
  var e={clouds:0,rain:0,snow:0,fog:false,flash:false,glow:false,stars:false,wind:!!windy},clear=false;
  switch(kind){
    case 'clear':clear=true;break;
    case 'fair':clear=true;e.clouds=0.45;break;
    case 'partly':clear=true;e.clouds=0.8;break;
    case 'cloudy':e.clouds=1;break;
    case 'fog':e.fog=true;e.clouds=0.45;break;
    case 'drizzle':e.clouds=0.9;e.rain=0.45;break;
    case 'showers':e.clouds=0.8;e.rain=0.75;break;
    case 'rain':e.clouds=1;e.rain=0.85;break;
    case 'heavyrain':e.clouds=1;e.rain=1;break;
    case 'sleet':e.clouds=1;e.rain=0.55;e.snow=0.75;break;
    case 'lightsnow':e.clouds=0.85;e.snow=0.6;break;
    case 'snow':e.clouds=1;e.snow=0.85;break;
    case 'heavysnow':e.clouds=1;e.snow=1;break;
    case 'thunder':e.clouds=1;e.rain=0.9;e.flash=true;break;
  }
  if(clear){if(day)e.glow=true;else e.stars=true;}
  return e;
}
/* Sky tint for the Today card. */
function tint(kind,day){
  if(kind==='thunder')return 'storm';
  if(/rain|drizzle|showers|sleet/.test(kind))return day?'rain':'nightcloud';
  if(/snow/.test(kind))return day?'snow':'nightcloud';
  if(kind==='fog'||kind==='cloudy')return day?'cloud':'nightcloud';
  return '';
}
function iconName(kind,day){
  switch(kind){
    case 'clear':case 'fair':case '':return day?'sun':'moon';
    case 'partly':return day?'partly_day':'partly_night';
    case 'fog':return 'fog';
    case 'drizzle':return 'drizzle';
    case 'rain':case 'heavyrain':case 'showers':return 'rain';
    case 'sleet':return 'sleet';
    case 'lightsnow':case 'snow':case 'heavysnow':return 'snow';
    case 'thunder':return 'thunder';
    default:return 'cloud';
  }
}
function icon(kind,day,size){
  var s=size||24;
  return '<svg class="wxicon" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" aria-hidden="true">'+(ICONS[iconName(kind,day)]||'')+'</svg>';
}
/* °F where people use it: decided by the place's time zone (the United States and Liberia), not the phone's language,
 * since many phones in India are set to English (United States). */
var F_ZONES=/^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Juneau|Sitka|Nome|Adak|Yakutat|Metlakatla|Boise|Detroit|Menominee|Indiana\/|Kentucky\/|North_Dakota\/)|Pacific\/Honolulu$|Africa\/Monrovia$|US\/)/;
function fahrenheitFor(zone){return F_ZONES.test(zone||'');}
function deg(c,f){return Math.round(f?c*9/5+32:c)+'°';}
/* Moving layers as markup; style.css animates them (and holds them still under prefers-reduced-motion). */
function fx(kind,day,windy){
  var e=effects(kind,day,windy),h='';
  if(e.glow)h+='<i class="glow"></i>';
  if(e.stars)h+='<i class="stars"></i><i class="stars b"></i>';
  if(e.clouds)h+='<i class="cloud c1" style="--a:'+e.clouds+'"></i><i class="cloud c2" style="--a:'+e.clouds+'"></i><i class="cloud c3" style="--a:'+e.clouds+'"></i>';
  if(e.fog)h+='<i class="fog"></i><i class="fog b"></i>';
  if(e.rain)h+='<i class="rain" style="--a:'+e.rain+'"></i>';
  if(e.snow)h+='<i class="snow" style="--a:'+e.snow+'"></i><i class="snow b" style="--a:'+e.snow+'"></i>';
  if(e.wind)h+='<i class="wind"></i>';
  if(e.flash)h+='<i class="flash"></i>';
  return h?'<div class="wxfx" data-wx="'+kind+'" aria-hidden="true">'+h+'</div>':'';
}
var api={at:at,effects:effects,tint:tint,icon:icon,iconName:iconName,deg:deg,fx:fx,fahrenheitFor:fahrenheitFor,ICONS:ICONS,WINDY_MS:WINDY_MS};
if(typeof module!=='undefined')module.exports=api;
root.SomaWeather=api;
})(typeof window!=='undefined'?window:globalThis);

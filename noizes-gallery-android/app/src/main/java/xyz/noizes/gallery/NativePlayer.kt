package xyz.noizes.gallery

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.tv.material3.*
import kotlinx.coroutines.delay
import xyz.noizes.gallery.data.*

@Composable fun NativePlayer(vm:GalleryViewModel,id:String,onBack:()->Unit){val context=androidx.compose.ui.platform.LocalContext.current;var item by remember{mutableStateOf<NoizesObjectEntity?>(null)};var manifest by remember{mutableStateOf<NoizesManifest?>(null)};var player by remember{mutableStateOf<ExoPlayer?>(null)};var playing by remember{mutableStateOf(false)};var position by remember{mutableLongStateOf(0)}
    LaunchedEffect(id){item=vm.item(id);manifest=item?.let{vm.manifest(it)};val tracks=manifest?.tracks?.sortedWith(compareBy({it.order?:Int.MAX_VALUE}));val chosen=tracks?.firstOrNull()?.file ?: manifest?.let{m->vm.parser.parse(android.net.Uri.parse(item!!.fileUri)).entries.firstOrNull{it.substringAfterLast('.').lowercase() in setOf("mp3","m4a","aac","flac","wav","ogg","opus")}};if(chosen!=null){val f=vm.cache(item!!,chosen);if(f!=null){player=ExoPlayer.Builder(context).build().apply{setMediaItem(MediaItem.fromUri(f.toURI().toString()));prepare();seekTo(item!!.progressMs)}}}}
    LaunchedEffect(player){while(player!=null){position=player?.currentPosition?:0;playing=player?.isPlaying==true;delay(500)}}
    DisposableEffect(player){onDispose{player?.let{vm.progress(id,it.currentPosition);it.release()}}}
    Box(Modifier.fillMaxSize().background(Color(0xFF030303)).padding(55.dp)){Row(horizontalArrangement=Arrangement.spacedBy(50.dp)){item?.let{ArchiveImage(vm,it,Modifier.size(430.dp))};Column(Modifier.padding(top=30.dp)){Text(item?.title?:"Opening…",fontSize=42.sp,fontWeight=androidx.compose.ui.text.font.FontWeight.ExtraBold);Text(item?.artist.orEmpty(),fontSize=23.sp,color=Color(0xB3FFFFFF));Spacer(Modifier.height(35.dp));Text(format(position),fontSize=18.sp);Spacer(Modifier.height(20.dp));Row(horizontalArrangement=Arrangement.spacedBy(15.dp)){Button(onClick={player?.let{if(it.isPlaying)it.pause()else it.play()}}){Text(if(playing)"Pause" else "Play")};OutlinedButton(onClick={player?.seekTo((player!!.currentPosition-10_000).coerceAtLeast(0))}){Text("−10s")};OutlinedButton(onClick={player?.seekTo(player!!.currentPosition+10_000)}){Text("+10s")};OutlinedButton(onClick=onBack){Text("Back")}};manifest?.tracks?.let{Text("${it.size.coerceAtLeast(1)} track object",modifier=Modifier.padding(top=24.dp),color=Color(0x66FFFFFF))}}}}}
private fun format(ms:Long)="%d:%02d".format(ms/60000,(ms/1000)%60)

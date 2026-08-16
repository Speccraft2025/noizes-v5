package xyz.noizes.gallery

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.net.Uri
import android.view.KeyEvent
import android.webkit.*
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.tv.material3.*
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import xyz.noizes.gallery.data.*
import java.io.ByteArrayInputStream

@SuppressLint("SetJavaScriptEnabled")
@Composable fun ExperienceRuntime(vm:GalleryViewModel,id:String,onExit:()->Unit){val context=androidx.compose.ui.platform.LocalContext.current;val scope=rememberCoroutineScope();var item by remember{mutableStateOf<NoizesObjectEntity?>(null)};var manifest by remember{mutableStateOf<NoizesManifest?>(null)};var player by remember{mutableStateOf<ExoPlayer?>(null)};var webView by remember{mutableStateOf<WebView?>(null)};var drawer by remember{mutableStateOf(false)}
    LaunchedEffect(id){item=vm.item(id);manifest=item?.let{vm.manifest(it)};if(manifest?.experience?.playbackMode=="host"){manifest?.tracks?.sortedBy{it.order?:Int.MAX_VALUE}?.firstOrNull()?.file?.let{path->vm.cache(item!!,path)?.let{f->player=ExoPlayer.Builder(context).build().apply{setMediaItem(MediaItem.fromUri(f.toURI().toString()));prepare();seekTo(item!!.progressMs)}}}}}
    DisposableEffect(player){onDispose{player?.let{vm.progress(id,it.currentPosition);it.release()};webView?.destroy()}}
    val active=item
    Box(Modifier.fillMaxSize().background(Color.Black)){
        if(active!=null) AndroidView(factory={ctx->WebView(ctx).apply{
            webView=this;settings.javaScriptEnabled=true;settings.domStorageEnabled=true;settings.allowFileAccess=false;settings.allowContentAccess=false;settings.mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW;settings.javaScriptCanOpenWindowsAutomatically=false;settings.setSupportMultipleWindows(false);settings.mediaPlaybackRequiresUserGesture=false
            addJavascriptInterface(NoizesBridge(playerProvider={player},metadata={Json.encodeToString(manifest)},exit=onExit,openDrawer={drawer=true}),"NoizesHost")
            webChromeClient=object:WebChromeClient(){override fun onCreateWindow(v:WebView?,dialog:Boolean,user:Boolean,msg:android.os.Message?)=false}
            webViewClient=object:WebViewClient(){
                override fun shouldOverrideUrlLoading(view:WebView?,request:WebResourceRequest):Boolean {val u=request.url;if(u.scheme=="https"&&u.host=="noizes.local")return false;Toast.makeText(ctx,"Online links are blocked until you approve them in Settings.",Toast.LENGTH_LONG).show();return true}
                override fun shouldInterceptRequest(view:WebView?,request:WebResourceRequest):WebResourceResponse?{val u=request.url;if(u.scheme!="https"||u.host!="noizes.local")return WebResourceResponse("text/plain","UTF-8",403,"Blocked",emptyMap(),ByteArrayInputStream(ByteArray(0)));val path=Uri.decode(u.path.orEmpty().removePrefix("/object/"));val bytes=vm.parser.readEntry(Uri.parse(active.fileUri),path)?:return WebResourceResponse("text/plain","UTF-8",404,"Missing",emptyMap(),ByteArrayInputStream(ByteArray(0)));return WebResourceResponse(mime(path),if(mime(path).startsWith("text/")||mime(path).contains("javascript")) "UTF-8" else null,ByteArrayInputStream(bytes))}
                override fun onRenderProcessGone(view:WebView?,detail:RenderProcessGoneDetail?):Boolean{Toast.makeText(ctx,"This experience stopped safely.",Toast.LENGTH_LONG).show();onExit();return true}
            }
            setOnKeyListener{_,key,event->if(event.action!=KeyEvent.ACTION_DOWN)return@setOnKeyListener false;when(key){KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE->{player?.let{if(it.isPlaying)it.pause()else it.play()};dispatch(this,key);true};KeyEvent.KEYCODE_MEDIA_REWIND->{player?.seekTo((player?.currentPosition?.minus(10_000)?:0).coerceAtLeast(0));true};KeyEvent.KEYCODE_MEDIA_FAST_FORWARD->{player?.seekTo((player?.currentPosition?:0)+10_000);true};KeyEvent.KEYCODE_MENU->{drawer=true;true};else->{dispatch(this,key);false}}}
            loadUrl("https://noizes.local/object/${active.experienceEntry}")
        }},modifier=Modifier.fillMaxSize())
        if(drawer)Box(Modifier.fillMaxHeight().width(340.dp).background(Color(0xEB050505)).padding(28.dp)){Column(verticalArrangement=Arrangement.spacedBy(14.dp)){Text("EXPERIENCE",color=Color(0xFF7B5CF0));Text(active?.title.orEmpty(),style=MaterialTheme.typography.headlineMedium);Button(onClick={player?.let{if(it.isPlaying)it.pause()else it.play()};drawer=false}){Text("Play / Pause")};OutlinedButton(onClick={drawer=false}){Text("Return to work")};OutlinedButton(onClick=onExit){Text("Exit Experience")}}}
    }
}

private class NoizesBridge(private val playerProvider:()->ExoPlayer?,private val metadata:()->String,private val exit:()->Unit,private val openDrawer:()->Unit){
    @get:JavascriptInterface val version:String get()="1.0"
    @JavascriptInterface fun ready(){}
    @JavascriptInterface fun play(){playerProvider()?.play()}
    @JavascriptInterface fun pause(){playerProvider()?.pause()}
    @JavascriptInterface fun seekTo(milliseconds:Long){playerProvider()?.seekTo(milliseconds.coerceAtLeast(0))}
    @JavascriptInterface fun getPlaybackState():String=playerProvider()?.let{"{\"playing\":${it.isPlaying},\"positionMs\":${it.currentPosition}}"}?:"{\"playing\":false,\"mode\":\"experience\"}"
    @JavascriptInterface fun getObjectMetadata():String=metadata()
    @JavascriptInterface fun openSection(sectionName:String){if(sectionName.length<64)openDrawer()}
    @JavascriptInterface fun exitExperience(){exit()}
    @JavascriptInterface fun requestOnlineResource(url:String):Boolean=false
}
private fun dispatch(web:WebView,key:Int){web.evaluateJavascript("window.dispatchEvent(new CustomEvent('noizes:remote',{detail:{keyCode:$key}}));",null)}
private fun mime(path:String)=when(path.substringAfterLast('.').lowercase()){ "html","htm"->"text/html";"js"->"application/javascript";"css"->"text/css";"json"->"application/json";"jpg","jpeg"->"image/jpeg";"png"->"image/png";"webp"->"image/webp";"svg"->"image/svg+xml";"mp3"->"audio/mpeg";"m4a"->"audio/mp4";"wav"->"audio/wav";"mp4"->"video/mp4";"webm"->"video/webm";else->"application/octet-stream"}

package xyz.noizes.gallery

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.BackHandler
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.*
import coil3.compose.AsyncImage
import xyz.noizes.gallery.data.*

private val Ink=Color(0xFF090A0A); private val Ivory=Color(0xFFE9E1D3); private val Muted=Color(0xFF9C988F); private val Brass=Color(0xFFC9AE7A)

class MainActivity:ComponentActivity(){
    private val vm by viewModels<GalleryViewModel>()
    override fun onCreate(state:Bundle?){super.onCreate(state);setContent{NoizesTheme{GalleryApp(vm)}}}
}

@Composable private fun NoizesTheme(content: @Composable () -> Unit)=MaterialTheme(colorScheme=darkColorScheme(background=Ink,surface=Color(0xFF151716),primary=Ivory,secondary=Brass),content=content)
private sealed interface Screen { data object Home:Screen; data class Detail(val id:String):Screen; data class Threshold(val id:String):Screen; data class Experience(val id:String):Screen; data class Audio(val id:String):Screen }

@Composable private fun GalleryApp(vm:GalleryViewModel){
    val context=androidx.compose.ui.platform.LocalContext.current; var onboarded by remember{mutableStateOf(context.getSharedPreferences("gallery",0).getBoolean("onboarded",false))}; var screen by remember{mutableStateOf<Screen>(Screen.Home)}
    val folder=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()){it?.let{uri->vm.addFolder(uri);context.getSharedPreferences("gallery",0).edit().putBoolean("onboarded",true).apply();onboarded=true}}
    val one=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()){it?.let(vm::importOne)}
    if(!onboarded){Onboarding(onChoose={folder.launch(null)},onSkip={context.getSharedPreferences("gallery",0).edit().putBoolean("onboarded",true).apply();onboarded=true});return}
    BackHandler(enabled=screen !is Screen.Home){screen=when(screen){is Screen.Experience->Screen.Detail((screen as Screen.Experience).id);is Screen.Threshold->Screen.Detail((screen as Screen.Threshold).id);is Screen.Audio->Screen.Detail((screen as Screen.Audio).id);else->Screen.Home}}
    when(val s=screen){
        Screen.Home->Home(vm,onOpen={screen=Screen.Detail(it)},onFolder={folder.launch(null)},onFile={one.launch(arrayOf("application/zip","application/octet-stream"))})
        is Screen.Detail->Detail(vm,s.id,onBack={screen=Screen.Home},onEnter={screen=Screen.Threshold(s.id)},onAudio={screen=Screen.Audio(s.id)})
        is Screen.Threshold->Threshold(vm,s.id,onEnter={screen=Screen.Experience(s.id)},onBack={screen=Screen.Detail(s.id)})
        is Screen.Experience->ExperienceRuntime(vm,s.id,onExit={screen=Screen.Detail(s.id)})
        is Screen.Audio->NativePlayer(vm,s.id,onBack={screen=Screen.Detail(s.id)})
    }
}

@Composable private fun Onboarding(onChoose:()->Unit,onSkip:()->Unit){Box(Modifier.fillMaxSize().background(Brush.radialGradient(listOf(Color(0xFF26231E),Ink))),contentAlignment=Alignment.Center){Column(Modifier.width(720.dp),horizontalAlignment=Alignment.CenterHorizontally){Text("NOIZES GALLERY",fontSize=18.sp,color=Brass,letterSpacing=5.sp);Spacer(Modifier.height(30.dp));Text("Your music objects.\nYour collection.\nYour listening room.",fontSize=48.sp,lineHeight=58.sp,color=Ivory);Spacer(Modifier.height(28.dp));Text("Noizes opens portable .nz music packages. Files remain on your device. Internet is optional.",fontSize=21.sp,color=Muted);Spacer(Modifier.height(38.dp));Row(horizontalArrangement=Arrangement.spacedBy(18.dp)){Button(onClick=onChoose){Text("Choose Library Folder")};OutlinedButton(onClick=onSkip){Text("Skip for now")}}}}}

@Composable private fun Home(vm:GalleryViewModel,onOpen:(String)->Unit,onFolder:()->Unit,onFile:()->Unit){val objects by vm.objects.collectAsState();val scan by vm.scan.collectAsState();Column(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF171816),Ink))).padding(48.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){Column{Text("NOIZES",fontSize=15.sp,letterSpacing=6.sp,color=Brass);Text("My Collection",fontSize=38.sp,fontWeight=FontWeight.Light,color=Ivory)};Row(horizontalArrangement=Arrangement.spacedBy(12.dp)){OutlinedButton(onClick=onFile){Text("Open .nz")};Button(onClick=onFolder){Text("Add Folder")};OutlinedButton(onClick=vm::rescan){Text("Rescan")}}};if(scan.active)Text("Scanning ${scan.scanned} of ${scan.total} objects  ·  ${scan.valid} valid  ·  ${scan.warnings} warning  ·  ${scan.invalid} invalid",color=Muted,modifier=Modifier.padding(top=12.dp));Spacer(Modifier.height(34.dp));if(objects.isEmpty())Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center){Text("Your gallery is quiet. Add a folder containing .nz objects.",fontSize=23.sp,color=Muted)}else LazyVerticalGrid(GridCells.Adaptive(230.dp),horizontalArrangement=Arrangement.spacedBy(22.dp),verticalArrangement=Arrangement.spacedBy(28.dp)){items(objects,key={it.id}){item->ObjectCard(vm,item){onOpen(item.id)}}}}}

@Composable private fun ObjectCard(vm:GalleryViewModel,item:NoizesObjectEntity,onClick:()->Unit){Card(onClick=onClick,modifier=Modifier.width(230.dp)){Column(Modifier.background(Color(0xFF141615)).padding(12.dp)){ArchiveImage(vm,item,Modifier.fillMaxWidth().aspectRatio(1f));Spacer(Modifier.height(14.dp));Text(item.title,fontSize=21.sp,color=Ivory,maxLines=1);Text(item.artist,fontSize=16.sp,color=Muted,maxLines=1);Row(Modifier.fillMaxWidth().padding(top=10.dp),horizontalArrangement=Arrangement.SpaceBetween){Text(item.editionName ?: "No edition",fontSize=12.sp,color=Muted);Text(if(item.authenticated==true)"VERIFIED" else item.validationStatus.name,fontSize=11.sp,color=if(item.validationStatus==ValidationStatus.INVALID)Color(0xFFE18B82)else Brass)}}}}

@Composable internal fun ArchiveImage(vm:GalleryViewModel,item:NoizesObjectEntity,modifier:Modifier=Modifier){var file by remember(item.id){mutableStateOf<java.io.File?>(null)};LaunchedEffect(item.id){item.coverEntry?.let{file=vm.cache(item,it)}};Box(modifier.background(Color(0xFF252621)),contentAlignment=Alignment.Center){if(file!=null)AsyncImage(model=file,contentDescription="Cover artwork for ${item.title}",modifier=Modifier.fillMaxSize())else Text("N",fontSize=60.sp,color=Brass)}}

@Composable private fun Detail(vm:GalleryViewModel,id:String,onBack:()->Unit,onEnter:()->Unit,onAudio:()->Unit){var item by remember{mutableStateOf<NoizesObjectEntity?>(null)};var manifest by remember{mutableStateOf<NoizesManifest?>(null)};LaunchedEffect(id){item=vm.item(id);item?.let{manifest=vm.manifest(it)}};val o=item?:return Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center){Text("Opening object…")};Row(Modifier.fillMaxSize().background(Ink).padding(55.dp),horizontalArrangement=Arrangement.spacedBy(55.dp)){ArchiveImage(vm,o,Modifier.fillMaxHeight().aspectRatio(1f));Column(Modifier.weight(1f)){Text("NOIZES OBJECT",fontSize=14.sp,letterSpacing=4.sp,color=Brass);Spacer(Modifier.height(22.dp));Text(o.title.uppercase(),fontSize=46.sp,color=Ivory);Text(o.artist,fontSize=25.sp,color=Muted);Spacer(Modifier.height(25.dp));o.editionName?.let{Text(it,fontSize=20.sp,color=Ivory)};if(o.editionNumber!=null)Text("${o.editionNumber.toString().padStart(3,'0')} / ${o.editionSize ?: "—"}",fontSize=18.sp,color=Muted);Text(if(o.authenticated==true)"Signature recorded" else "No verified authenticity record",fontSize=15.sp,color=Brass,modifier=Modifier.padding(top=10.dp));Spacer(Modifier.height(35.dp));Row(horizontalArrangement=Arrangement.spacedBy(14.dp)){Button(onClick=onEnter,enabled=o.validationStatus!=ValidationStatus.INVALID){Text("Enter Experience")};OutlinedButton(onClick=onAudio){Text(if(o.progressMs>0)"Resume Audio" else "Play Audio")};OutlinedButton(onClick=onBack){Text("Back")}};Spacer(Modifier.height(32.dp));Text("PACKAGE VALIDATION",fontSize=13.sp,letterSpacing=2.sp,color=Muted);Text(o.validationStatus.name.replace('_',' '),fontSize=20.sp,color=if(o.validationStatus==ValidationStatus.INVALID)Color(0xFFE18B82)else Brass);if(o.validationIssues.isNotBlank())Text(o.validationIssues,fontSize=15.sp,lineHeight=22.sp,color=Muted,modifier=Modifier.padding(top=8.dp));manifest?.tracks?.takeIf{it.isNotEmpty()}?.let{tracks->Spacer(Modifier.height(24.dp));Text("${tracks.size} TRACKS",fontSize=13.sp,color=Muted)}}}}

@Composable private fun Threshold(vm:GalleryViewModel,id:String,onEnter:()->Unit,onBack:()->Unit){var item by remember{mutableStateOf<NoizesObjectEntity?>(null)};LaunchedEffect(id){item=vm.item(id)};val o=item?:return;Box(Modifier.fillMaxSize().background(Brush.radialGradient(listOf(Color(0xFF29251F),Ink))),contentAlignment=Alignment.Center){Column(horizontalAlignment=Alignment.CenterHorizontally){Text("NOIZES OBJECT",letterSpacing=5.sp,fontSize=14.sp,color=Brass);Spacer(Modifier.height(32.dp));Text(o.title.uppercase(),fontSize=52.sp,color=Ivory);Text(o.artist,fontSize=22.sp,color=Muted);Spacer(Modifier.height(28.dp));o.editionName?.let{Text(it,fontSize=20.sp,color=Ivory)};if(o.editionNumber!=null)Text("${o.editionNumber.toString().padStart(3,'0')} / ${o.editionSize ?: "—"}",fontSize=17.sp,color=Muted);Spacer(Modifier.height(42.dp));Row(horizontalArrangement=Arrangement.spacedBy(16.dp)){Button(onClick=onEnter){Text("ENTER")};OutlinedButton(onClick=onBack){Text("RETURN")}}}}}

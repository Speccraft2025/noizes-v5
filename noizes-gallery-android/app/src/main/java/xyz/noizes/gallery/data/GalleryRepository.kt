package xyz.noizes.gallery.data

import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import androidx.documentfile.provider.DocumentFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.withContext
import java.io.File

data class ScanProgress(val active: Boolean=false, val scanned:Int=0, val total:Int=0, val valid:Int=0, val warnings:Int=0, val invalid:Int=0)

class GalleryRepository(private val context: Context, private val dao: GalleryDao, val parser: NzPackageParser) {
    val objects = dao.observeObjects(); val locations = dao.observeLocations()
    private val _scan = MutableStateFlow(ScanProgress()); val scan: StateFlow<ScanProgress> = _scan

    suspend fun addFolder(uri: Uri) = withContext(Dispatchers.IO) {
        context.contentResolver.takePersistableUriPermission(uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
        dao.putLocation(LibraryLocationEntity(uri.toString(), DocumentFile.fromTreeUri(context, uri)?.name ?: "Local library", System.currentTimeMillis()))
        scanFolder(uri)
    }
    suspend fun importOne(uri: Uri) = withContext(Dispatchers.IO) { index(uri, DocumentFile.fromSingleUri(context,uri)?.name ?: "Object.nz", System.currentTimeMillis()) }
    suspend fun rescanAll() { locations.first().forEach { scanFolder(Uri.parse(it.uri)) } }
    suspend fun scanFolder(uri: Uri) = withContext(Dispatchers.IO) {
        val files = buildList { collect(DocumentFile.fromTreeUri(context, uri), this) }
        var valid=0; var warn=0; var invalid=0; _scan.value=ScanProgress(true,0,files.size)
        files.forEachIndexed { i,f -> val result=index(f.uri,f.name ?: "Object.nz",f.lastModified()); when(result){ValidationStatus.VALID->valid++;ValidationStatus.WARNING->warn++;ValidationStatus.INVALID->invalid++}; _scan.value=ScanProgress(true,i+1,files.size,valid,warn,invalid) }
        _scan.value=_scan.value.copy(active=false)
    }
    private fun collect(node: DocumentFile?, out: MutableList<DocumentFile>) { if(node==null)return; if(node.isFile && node.name?.endsWith(".nz",true)==true) out+=node else if(node.isDirectory) node.listFiles().forEach { collect(it,out) } }
    private suspend fun index(uri:Uri,name:String,modified:Long):ValidationStatus {
        val parsed=parser.parse(uri); val m=parsed.manifest; val cover=m?.cover ?: parsed.entries.firstOrNull { it.startsWith("cover/") || it.matches(Regex("cover\\.(jpg|jpeg|png|webp)",RegexOption.IGNORE_CASE)) }
        dao.put(NoizesObjectEntity(parsed.hash.ifBlank { uri.toString() },m?.releaseId.orEmpty(),uri.toString(),name,m?.title ?: name,m?.artist ?: "Unknown artist",cover,m?.experience?.entry ?: "experience.html",m?.edition?.name,m?.edition?.number,m?.edition?.size,m?.authenticity?.authenticated,parsed.hash,modified,System.currentTimeMillis(),parsed.status,parsed.issues.joinToString("\n")))
        return parsed.status
    }
    suspend fun objectById(id:String)=dao.get(id)
    suspend fun metadata(item:NoizesObjectEntity)=parser.parse(Uri.parse(item.fileUri)).manifest
    suspend fun cacheEntry(item:NoizesObjectEntity,entry:String):File?=withContext(Dispatchers.IO){ val bytes=parser.readEntry(Uri.parse(item.fileUri),entry)?:return@withContext null; val dir=File(context.cacheDir,"objects/${item.id}").apply{mkdirs()}; val file=File(dir,entry.substringAfterLast('/')); file.writeBytes(bytes); file }
    suspend fun saveProgress(id:String,ms:Long)=dao.progress(id,ms,System.currentTimeMillis())
}

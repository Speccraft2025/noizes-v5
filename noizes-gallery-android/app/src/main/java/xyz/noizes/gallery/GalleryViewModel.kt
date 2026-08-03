package xyz.noizes.gallery

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import xyz.noizes.gallery.data.*

class GalleryViewModel(app:Application):AndroidViewModel(app){
    private val repo=(app as GalleryApplication).repository
    val objects=repo.objects.stateIn(viewModelScope,SharingStarted.WhileSubscribed(5000),emptyList())
    val scan=repo.scan
    fun addFolder(uri:Uri)=viewModelScope.launch{repo.addFolder(uri)}
    fun importOne(uri:Uri)=viewModelScope.launch{repo.importOne(uri)}
    fun rescan()=viewModelScope.launch{repo.rescanAll()}
    suspend fun item(id:String)=repo.objectById(id)
    suspend fun manifest(item:NoizesObjectEntity)=repo.metadata(item)
    suspend fun cache(item:NoizesObjectEntity,path:String)=repo.cacheEntry(item,path)
    fun progress(id:String,ms:Long)=viewModelScope.launch{repo.saveProgress(id,ms)}
    val parser get()=repo.parser
}

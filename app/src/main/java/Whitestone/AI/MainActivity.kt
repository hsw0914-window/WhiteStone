package Whitestone.AI

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.location.Location
import android.os.Bundle
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.constraintlayout.widget.ConstraintSet
import androidx.core.app.ActivityCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.gms.location.*
import com.google.android.material.floatingactionbutton.FloatingActionButton
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var mainConstraintLayout: ConstraintLayout
    private lateinit var topBarContainer: LinearLayout
    private lateinit var toggleChatbotButton: FloatingActionButton
    private lateinit var chatLogRecyclerView: RecyclerView
    private lateinit var chatInputEditText: EditText
    private lateinit var mapWebView: WebView
    private lateinit var mapContainer: android.widget.FrameLayout

    private lateinit var chatAdapter: ChatAdapter
    private val messageList = ArrayList<ChatMessage>()
    private val botClient = ChatBotClient()

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var currentLat: Double? = null
    private var currentLng: Double? = null
    private var mapLoaded = false

    private var currentDestination: ChatBotClient.Destination? = null
    private var currentStepIndex = 0

    companion object {
        private val timeFormat = SimpleDateFormat("a hh:mm", Locale.KOREA)
        private const val LOCATION_PERMISSION_REQUEST = 1001
        private const val STEP_ADVANCE_DISTANCE_M = 15f
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.white_stone_main)

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        initViews()
        setupChatbotUI()
        setupRecyclerView()
        setupMapWebView()
        setupLocationCallback()
        requestLocationPermission()
    }

    private fun initViews() {
        mainConstraintLayout = findViewById(R.id.mainConstraintLayout)
        topBarContainer = findViewById(R.id.topBarContainer)
        toggleChatbotButton = findViewById(R.id.toggleChatbotButton)
        chatLogRecyclerView = findViewById(R.id.chatLogRecyclerView)
        chatInputEditText = findViewById(R.id.chatInputEditText)
        mapWebView = findViewById(R.id.mapWebView)
        mapContainer = findViewById(R.id.mapContainer)
        findViewById<ImageView>(R.id.mapCloseButton).setOnClickListener {
            closeMap()
        }
    }

    private fun setupChatbotUI() {
        val closeIcon: ImageView = findViewById(R.id.topBarCloseIcon)
        val sendButton: ImageView = findViewById(R.id.sendButton)
        closeIcon.setOnClickListener { toggleTopBar(isVisible = false) }
        toggleChatbotButton.setOnClickListener { toggleTopBar(isVisible = true) }
        sendButton.setOnClickListener { handleSendButtonClick() }
    }

    private fun toggleTopBar(isVisible: Boolean) {
        topBarContainer.visibility = if (isVisible) View.VISIBLE else View.GONE
        toggleChatbotButton.visibility = if (isVisible) View.GONE else View.VISIBLE
        val constraintSet = ConstraintSet().apply { clone(mainConstraintLayout) }
        if (isVisible) {
            constraintSet.connect(chatLogRecyclerView.id, ConstraintSet.TOP, topBarContainer.id, ConstraintSet.BOTTOM)
        } else {
            constraintSet.connect(chatLogRecyclerView.id, ConstraintSet.TOP, ConstraintSet.PARENT_ID, ConstraintSet.TOP)
        }
        constraintSet.applyTo(mainConstraintLayout)
    }

    private fun setupRecyclerView() {
        chatAdapter = ChatAdapter(messageList)
        chatLogRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = chatAdapter
        }
        addMessageToChat("백석대학교 챗봇 흰돌이입니다. 무엇을 도와드릴까요?", isUser = false)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupMapWebView() {
        mapWebView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
        }
        mapWebView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                mapLoaded = true
            }
        }
    }

    private fun setupLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val location = result.lastLocation ?: return
                currentLat = location.latitude
                currentLng = location.longitude

                if (mapContainer.visibility == View.VISIBLE) {
                    sendLocationToMap(location.latitude, location.longitude)
                    checkStepAdvancement(location)
                }
            }
        }
    }

    private fun checkStepAdvancement(location: Location) {
        val dest = currentDestination ?: return
        val steps = dest.steps
        if (currentStepIndex >= steps.size - 1) return

        val nextStep = steps[currentStepIndex + 1]
        val stepLat = nextStep.lat ?: return
        val stepLng = nextStep.lng ?: return

        val dist = FloatArray(1)
        Location.distanceBetween(location.latitude, location.longitude, stepLat, stepLng, dist)

        if (dist[0] < STEP_ADVANCE_DISTANCE_M) {
            currentStepIndex++
            mapWebView.evaluateJavascript(
                "highlightStep($currentStepIndex)", null
            )
        }
    }

    private fun sendLocationToMap(lat: Double, lng: Double) {
        val msg = JSONObject()
            .put("type", "UPDATE_LOCATION")
            .put("lat", lat)
            .put("lng", lng)
            .toString().replace("'", "\\'")
        mapWebView.evaluateJavascript("handleMessage({data: '$msg'})", null)
    }

    private fun showMap(destination: ChatBotClient.Destination) {
        currentDestination = destination
        currentStepIndex = 0

        // 채팅 숨기고 지도 전체화면 표시
        chatLogRecyclerView.visibility = View.GONE
        mapContainer.visibility = View.VISIBLE

        if (!mapLoaded) {
            mapWebView.loadUrl("${ChatBotClient.BASE_URL}/map")
        }

        val delayMs = if (mapLoaded) 0L else 2500L
        mapWebView.postDelayed({
            val routeJson = JSONArray().also { arr ->
                destination.route.forEach { pt ->
                    arr.put(JSONObject().put("lat", pt.lat).put("lng", pt.lng))
                }
            }
            val stepsJson = JSONArray().also { arr ->
                destination.steps.forEach { s ->
                    arr.put(JSONObject()
                        .put("direction", s.direction)
                        .put("distance", s.distance)
                        .put("lat", s.lat ?: JSONObject.NULL)
                        .put("lng", s.lng ?: JSONObject.NULL))
                }
            }
            val destJson = JSONObject()
                .put("place_name", destination.placeName)
                .put("lat", destination.lat)
                .put("lng", destination.lng)

            val drawMsg = JSONObject()
                .put("type", "DRAW_ROUTE")
                .put("route", routeJson)
                .put("destination", destJson)
                .put("steps", stepsJson)
                .put("distance", destination.distance)
                .put("duration", destination.duration)
                .toString().replace("'", "\\'")

            mapWebView.evaluateJavascript("handleMessage({data: '$drawMsg'})", null)

            currentLat?.let { lat ->
                currentLng?.let { lng -> sendLocationToMap(lat, lng) }
            }
        }, delayMs)

        startLocationUpdates()
    }

    private fun closeMap() {
        mapContainer.visibility = View.GONE
        chatLogRecyclerView.visibility = View.VISIBLE
        mapWebView.evaluateJavascript("clearRoute()", null)
        currentDestination = null
        currentStepIndex = 0
        // GPS는 계속 유지 (다음 안내 요청을 위해)
    }

    private fun handleSendButtonClick() {
        val inputText = chatInputEditText.text.toString().trim()
        if (inputText.isEmpty()) return

        addMessageToChat(inputText, isUser = true)
        chatInputEditText.text.clear()

        botClient.sendMessage(inputText, currentLat, currentLng, object : ChatBotClient.BotResponseListener {
            override fun onSuccess(replyText: String, destination: ChatBotClient.Destination?) {
                addMessageToChat(replyText, isUser = false)
                destination?.let { showMap(it) }
            }
            override fun onError(errorMessage: String) {
                Toast.makeText(this@MainActivity, errorMessage, Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun addMessageToChat(text: String, isUser: Boolean) {
        val currentTime = timeFormat.format(Date())
        messageList.add(ChatMessage(text, isUser, currentTime))
        val newPosition = messageList.size - 1
        chatAdapter.notifyItemInserted(newPosition)
        chatLogRecyclerView.scrollToPosition(newPosition)
    }

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates() {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 2000L)
            .setMinUpdateIntervalMillis(1000L)
            .build()
        fusedLocationClient.requestLocationUpdates(request, locationCallback, mainLooper)
    }

    private fun stopLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
    }

    private fun requestLocationPermission() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION),
                LOCATION_PERMISSION_REQUEST
            )
        } else {
            fetchInitialLocation()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == LOCATION_PERMISSION_REQUEST &&
            grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            fetchInitialLocation()
        }
    }

    @SuppressLint("MissingPermission")
    private fun fetchInitialLocation() {
        // 앱 시작부터 위치 추적 시작 (지도 열기 전에도 GPS 확보)
        startLocationUpdates()
        fusedLocationClient.lastLocation.addOnSuccessListener { location ->
            location?.let {
                currentLat = it.latitude
                currentLng = it.longitude
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopLocationUpdates()
    }
}

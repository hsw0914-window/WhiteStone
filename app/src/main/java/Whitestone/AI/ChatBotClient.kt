package Whitestone.AI

import android.os.Handler
import android.os.Looper
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class ChatBotClient {

    interface BotResponseListener {
        fun onSuccess(replyText: String, destination: Destination? = null)
        fun onError(errorMessage: String)
    }

    data class Step(val direction: String, val distance: Int, val lat: Double?, val lng: Double?)

    data class Destination(
        val placeName: String,
        val lat: Double,
        val lng: Double,
        val route: List<RoutePoint>,
        val steps: List<Step> = emptyList(),
        val distance: Int = 0,
        val duration: Int = 0
    )

    data class RoutePoint(val lat: Double, val lng: Double)

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
    private val mainHandler = Handler(Looper.getMainLooper())

    companion object {
        // 실제 기기는 PC의 로컬 IP 주소로 변경 (ipconfig로 확인)
        // 에뮬레이터 사용 시: 10.0.2.2
        const val BASE_URL = "http://192.168.0.9:8000"

        private val LOCATION_KEYWORDS = listOf("어디", "위치", "찾아", "가고 싶", "안내", "길", "어떻게 가")
    }

    fun sendMessage(userMessage: String, userLat: Double?, userLng: Double?, listener: BotResponseListener) {
        if (isLocationQuestion(userMessage) && userLat != null && userLng != null) {
            sendNavigateRequest(userMessage, userLat, userLng, listener)
        } else {
            sendChatRequest(userMessage, listener)
        }
    }

    private fun isLocationQuestion(message: String) = LOCATION_KEYWORDS.any { message.contains(it) }

    private fun sendChatRequest(question: String, listener: BotResponseListener) {
        val body = JSONObject().put("question", question).toString()
            .toRequestBody("application/json".toMediaType())

        val request = Request.Builder().url("$BASE_URL/chat").post(body).build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                mainHandler.post { listener.onError("서버 연결 실패: ${e.message}") }
            }

            override fun onResponse(call: Call, response: Response) {
                val json = JSONObject(response.body?.string() ?: "{}")
                val answer = json.optString("answer", "답변을 가져오지 못했습니다.")
                mainHandler.post { listener.onSuccess(answer) }
            }
        })
    }

    private fun sendNavigateRequest(question: String, lat: Double, lng: Double, listener: BotResponseListener) {
        val body = JSONObject()
            .put("question", question)
            .put("lat", lat)
            .put("lng", lng)
            .toString()
            .toRequestBody("application/json".toMediaType())

        val request = Request.Builder().url("$BASE_URL/navigate").post(body).build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                mainHandler.post { listener.onError("서버 연결 실패: ${e.message}") }
            }

            override fun onResponse(call: Call, response: Response) {
                val json = JSONObject(response.body?.string() ?: "{}")
                if (json.has("error")) {
                    mainHandler.post { listener.onSuccess(json.getString("error")) }
                    return
                }

                val dest = json.getJSONObject("destination")
                val routeArray = json.getJSONArray("route")
                val routePoints = (0 until routeArray.length()).map {
                    val pt = routeArray.getJSONObject(it)
                    RoutePoint(pt.getDouble("lat"), pt.getDouble("lng"))
                }

                val stepsArray = json.optJSONArray("steps")
                val steps = if (stepsArray != null) {
                    (0 until stepsArray.length()).map {
                        val s = stepsArray.getJSONObject(it)
                        Step(
                            direction = s.optString("direction", "직진"),
                            distance  = s.optInt("distance", 0),
                            lat       = if (s.isNull("lat")) null else s.getDouble("lat"),
                            lng       = if (s.isNull("lng")) null else s.getDouble("lng")
                        )
                    }
                } else emptyList()

                val destination = Destination(
                    placeName = dest.getString("place_name"),
                    lat       = dest.getDouble("lat"),
                    lng       = dest.getDouble("lng"),
                    route     = routePoints,
                    steps     = steps,
                    distance  = json.optInt("distance", 0),
                    duration  = json.optInt("duration", 0)
                )

                mainHandler.post {
                    listener.onSuccess(
                        json.optString("answer", "${destination.placeName}으로 안내합니다."),
                        destination
                    )
                }
            }
        })
    }
}

package Whitestone.AI

import android.os.Handler
import android.os.Looper

class ChatBotClient {

    interface BotResponseListener {
        fun onSuccess(replyText: String)
        fun onError(errorMessage: String)
    }

    fun sendMessageToServer(userMessage: String, listener: BotResponseListener) {
        // TODO  실제 FastAPI 통신 코드를 작성부분입니다.

        Handler(Looper.getMainLooper()).postDelayed({
            val mockResponse = "벡엔드 연결 필요'${userMessage}'리턴"
            listener.onSuccess(mockResponse)
        }, 1000)
    }
}
package Whitestone.AI

import android.os.Bundle
import android.view.View
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.constraintlayout.widget.ConstraintSet
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.floatingactionbutton.FloatingActionButton
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    // 뷰(화면 요소) 변수들
    private lateinit var mainConstraintLayout: ConstraintLayout
    private lateinit var topBarContainer: LinearLayout
    private lateinit var toggleChatbotButton: FloatingActionButton
    private lateinit var chatLogRecyclerView: RecyclerView
    private lateinit var chatInputEditText: EditText

    // 리스트 및 어댑터
    private lateinit var chatAdapter: ChatAdapter
    private val messageList = ArrayList<ChatMessage>()

    // 서버 통신을 담당할 클라이언트 객체 생성
    private val botClient = ChatBotClient()

    companion object {
        // 날짜 포맷터
        private val timeFormat = SimpleDateFormat("a hh:mm", Locale.KOREA)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.white_stone_main)

        initViews()
        setupChatbotUI()
        setupRecyclerView()
    }

    // 1. 화면의 뷰를 연결
    private fun initViews() {
        mainConstraintLayout = findViewById(R.id.mainConstraintLayout)
        topBarContainer = findViewById(R.id.topBarContainer)
        toggleChatbotButton = findViewById(R.id.toggleChatbotButton)
        chatLogRecyclerView = findViewById(R.id.chatLogRecyclerView)
        chatInputEditText = findViewById(R.id.chatInputEditText)
    }

    // 2. 버튼 클릭 이벤트 등을 설정
    private fun setupChatbotUI() {
        val closeIcon: ImageView = findViewById(R.id.topBarCloseIcon)
        val sendButton: ImageView = findViewById(R.id.sendButton)

        closeIcon.setOnClickListener { toggleTopBar(isVisible = false) }
        toggleChatbotButton.setOnClickListener { toggleTopBar(isVisible = true) }
        sendButton.setOnClickListener { handleSendButtonClick() }
    }

    // 탑바 열기/닫기 처리 함수
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

    // 3. 채팅창 초기 설정 함수
    private fun setupRecyclerView() {
        chatAdapter = ChatAdapter(messageList)
        chatLogRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = chatAdapter
        }

        // 챗봇 첫 인사말 추가
        addMessageToChat("백석대학교 챗봇 흰돌이입니다. 무엇을 도와드릴까요?", isUser = false)
    }

    // 전송 버튼을 눌렀을 때의 처리 흐름
    private fun handleSendButtonClick() {
        val inputText = chatInputEditText.text.toString().trim()

        if (inputText.isNotEmpty()) {
            // 1. 내가 입력한 메시지를 화면에 띄움
            addMessageToChat(inputText, isUser = true)
            chatInputEditText.text.clear()

            // 2. 백엔드 클라이언트(ChatBotClient)를 호출하여 서버로 메시지 전송
            botClient.sendMessageToServer(inputText, object : ChatBotClient.BotResponseListener {
                // 성공적으로 서버에서 답변을 받았을 때 실행됨
                override fun onSuccess(replyText: String) {
                    addMessageToChat(replyText, isUser = false)
                }

                // 서버 통신 중 에러가 발생했을 때 실행됨
                override fun onError(errorMessage: String) {
                    // 에러 메시지는 토스트(팝업)로 잠깐 띄워줌
                    Toast.makeText(this@MainActivity, errorMessage, Toast.LENGTH_SHORT).show()
                }
            })
        }
    }

    // 채팅 리스트에 말풍선을 추가하고 맨 아래로 스크롤하는 공통 함수
    private fun addMessageToChat(text: String, isUser: Boolean) {
        val currentTime = timeFormat.format(Date())
        messageList.add(ChatMessage(text, isUser, currentTime))

        val newPosition = messageList.size - 1
        chatAdapter.notifyItemInserted(newPosition)
        chatLogRecyclerView.scrollToPosition(newPosition)
    }
}
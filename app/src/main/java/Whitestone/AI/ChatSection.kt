package Whitestone.AI

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView


//채팅창에 띄울 하나의 대화정보를 담는 상자.
data class ChatMessage(
    val text: String,
    val isUser: Boolean,
    val time: String       // 메시지 전송 시간 (예: "오후 1:00")
)

/**
 * 채팅창 어댑터 
 * 대화 내역를 받아와서 화면의 말풍선 UI에 하나씩 연결해 주는 핵심 클래스.
 */
class ChatAdapter(private val messageList: ArrayList<ChatMessage>) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

   
    companion object {
        private const val VIEW_TYPE_USER = 1 // 내 말풍선 타입
        private const val VIEW_TYPE_BOT = 2  // 봇 말풍선 타입
    }

    //현재 그릴 메시지가 봇인지 사용자것인지 판단.
    override fun getItemViewType(position: Int): Int =
        if (messageList[position].isUser) VIEW_TYPE_USER else VIEW_TYPE_BOT

    //위에서 결정된 viewType에 따라 파란 말풍선 또는 회색 말풍선 레이아웃을 가져와서 객체로 만듭니다.
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)

        return if (viewType == VIEW_TYPE_USER) {
            // 사용자 메시지용 XML을 연결하여 UserViewHolder 생성
            UserViewHolder(inflater.inflate(R.layout.item_chat_user, parent, false))
        } else {
            // 봇 메시지용 XML을 연결하여 BotViewHolder 생성
            BotViewHolder(inflater.inflate(R.layout.item_chat_bot, parent, false))
        }
    }

    /**
     * 만들어진 빈 말풍선 안에 실제 데이터를 채워 넣습니다.
     * 스크롤을 내릴 때마다 이 함수가 불리며 새로운 글자와 시간으로 업데이트됩니다.
     */
    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        val message = messageList[position] // 현재 순서의 데이터 가져오기

        when (holder) {
            // 사용자 말풍선인 경우
            is UserViewHolder -> {
                holder.userMessageText.text = message.text
                holder.userTimeText.text = message.time
            }
            // 봇 말풍선인 경우
            is BotViewHolder -> {
                holder.botMessageText.text = message.text
                holder.botTimeText.text = message.time
            }
        }
    }

    /**
     *  총 몇 개의 대화가 있는지 개수를 알려줍니다.
     * 리사이클러뷰가 화면을 얼마나 길게 스크롤해야 할지 결정하는 데 쓰입니다.
     */
    override fun getItemCount(): Int = messageList.size

    //메모리에 올려둔 내 말풍선 XML 안에 있는 텍스트뷰들을 코드와 연결한다.

    class UserViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val userMessageText: TextView = itemView.findViewById(R.id.textUserMessage)
        val userTimeText: TextView = itemView.findViewById(R.id.textUserTime)
    }

    //메모리에 올려둔 봇 말풍선 XML 안에 있는 텍스트뷰들을 코드와 연결한다.

    class BotViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val botMessageText: TextView = itemView.findViewById(R.id.textBotMessage)
        val botTimeText: TextView = itemView.findViewById(R.id.textBotTime)
    }
}
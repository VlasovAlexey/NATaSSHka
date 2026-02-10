package com.natasshka.messenger

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class UsersAdapter(private val users: MutableList<String> = mutableListOf()) :
    RecyclerView.Adapter<UsersAdapter.UserViewHolder>() {

    class UserViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val userName: TextView = itemView.findViewById(R.id.userName)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): UserViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_user, parent, false)
        return UserViewHolder(view)
    }

    override fun onBindViewHolder(holder: UserViewHolder, position: Int) {
        val user = users[position]
        holder.userName.text = "✪ $user"
    }

    override fun getItemCount(): Int = users.size

    fun updateUsers(newUsers: List<String>) {
        users.clear()
        users.addAll(newUsers)
        notifyDataSetChanged()
    }

    fun addUser(user: String) {
        if (!users.contains(user)) {
            users.add(user)
            notifyItemInserted(users.size - 1)
        }
    }

    fun removeUser(user: String) {
        val index = users.indexOf(user)
        if (index != -1) {
            users.removeAt(index)
            notifyItemRemoved(index)
        }
    }

    fun clearUsers() {
        users.clear()
        notifyDataSetChanged()
    }
}
from django.shortcuts import render,redirect,get_object_or_404
from django.http import HttpResponse
import requests
import pandas as pd
from django.contrib import messages

from . import forms
from .models import Hackathon, Fest, Esummit,teammatesearch,userid_githubuser,team_requests
from .forms import HackForm, Festform, Esform,create_team_request
import pickle


def events(request):
    data=Hackathon.objects.all()
    context = {'data': data}
    return render(request, 'events.html', context)
# Create your views here.

def hack_submit(request):
    form = forms.HackForm()
    if request.method == 'POST':
        form = HackForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            my_model = Hackathon.objects.create(
                name=data['name'],
                image=data['image'],
                venue=data['venue'],
                prize_money=data['prize_money'],
                description=data['description'],
                date=data['date'],
                Apply=data['Apply'],
            )
            return HttpResponse('data submitted successfully')
    else:
        form = forms.HackForm()
    form = forms.HackForm()
    return render(request, 'hack_reg.html', {'form': form})

def fest_submit(request):
    
    form = forms.Festform()
    if request.method=='POST':
        form = Festform(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            my_model = Fest.objects.create(
                name=data['name'],
                venue=data['venue'],
                description=data['description'],
                checkout=data['checkout'],
            )
            return HttpResponse('data submitted successfully')
    else:
        form=forms.Festform()
        
    return render(request, 'fest_reg.html', {'form': form})

def Es_submit(request):
    form = forms.Esform()
    if request.method=='Post':
        form = Esform(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            my_model = Esummit.objects.create(
                name=data['name'],
                venue=data['venue'],
                description=data['description'],
                checkout=data['checkout'],
            )
            return HttpResponse('data submitted successfully')
    else:
        form=forms.Esform()
    return render(request, 'es_reg.html', {'form': form})


def home(request):
    return render(request, 'test_home.html')


def teamsearch(request):
    # if request.method=='POST':
    #     github_userr=request.POST['github_user']
    #     user_id=request.user.id
    #     Mymodel=userid_githubuser.objects.create(
    #         user_id=user_id,
    #         github_username=github_userr,
    #         )
    #     messages.success(request, 'github username attached successfully')
    data=teammatesearch.objects.all()
    context = {'data': data}
    # if request.method=='Post':
    #    data=request.POST
    #    value=get_object_or_404(teammatesearch, pk=pk)
    #    context = {
    #        'data': data,
    #        'value': value
    #        }
    #    redirect('team_analysis.html', context)  
  
    return render(request, 'teamsearch.html',context)

def addteamreq(request):
    if request.method == 'POST':
        form = create_team_request(request.POST)
        if form.is_valid():
            mymodel=teammatesearch.objects.create(
                hackathon_name=form.cleaned_data['hackathon_name'],
                team=form.cleaned_data['team'],
                name=form.cleaned_data['name'],
                email=form.cleaned_data['email'],
                phone=form.cleaned_data['phone'],
                github1=form.cleaned_data['github1'],
                
                name2=form.cleaned_data['name2'],
                email2=form.cleaned_data['email2'],
                phone2=form.cleaned_data['phone2'],
                github2=form.cleaned_data['github2'],
                
                name3=form.cleaned_data['name3'],
                email3=form.cleaned_data['email3'],
                phone3=form.cleaned_data['phone3'],
                github3=form.cleaned_data['github3'],
            )
            return HttpResponse('data submitted successfully')
                
            # redirect or do something else
    else:
        form = create_team_request()
    return render(request, 'addteamreq.html',{'form': form})

def team_analysis(request,slug):
    team=teammatesearch.objects.get(slug=slug)
    model=pickle.load(open('/Users/harshdhariwal/Desktop/hackdate/simple-django-login-and-register/source/content/model/model.pkl','rb+'))
    url = f"https://api.github.com/users/{team.github1}/events/public"
    response = requests.get(url)
    data = response.json()
    contributions = len([event for event in data if event['type'] == 'PushEvent'])
    temp={}
    temp['contrib1']=len([event for event in data if event['type'] == 'PushEvent'])

    if team.github2:
        url = f"https://api.github.com/users/{team.github2}/events/public"
        response = requests.get(url)
        data = response.json()
        temp['contrib2'] = len([event for event in data if event['type'] == 'PushEvent'])
    else:
        temp['contrib2']=0.0
    if team.github3:
        url = f"https://api.github.com/users/{team.github3}/events/public"
        response = requests.get(url)
        data = response.json()
        temp['contrib3'] = len([event for event in data if event['type'] == 'PushEvent'])
    else:
        temp['contrib3']=0.0
    print("contributions found--------------------")
    print("c1",temp['contrib1'],"c2",temp['contrib2'],"c3",temp['contrib3'])
    testdata=pd.DataFrame({'x':temp}).transpose()
    scoreval=model.predict(testdata)[0]
    print("value comes here-----------")
    scoreval=int(scoreval)
    print(scoreval)
    context={
        'team':team,
        'scoreval':scoreval,
       
 
    }
    
    return render(request, 'team_analysis.html',context)


def teamsendreq(request,slug):
   
        
    context={
        'team':team,
    }
    return render(request, 'teamsendreq.html',context)


def maketeamreq(request,slug):
    print("entered maketeam request portal --------------")
    team=teammatesearch.objects.get(slug=slug)
    print("team name is ",team.name)
    hackathon_name=team.hackathon_name
    team_leader=team.name
    req_maker = request.user.id
    github_user = userid_githubuser.objects.filter(user_id=request.user.id)[0]
    Mymodel=team_requests.objects.create(
        hacakthon_name=hackathon_name,
        user_id=req_maker,
        user_id_rec=team_leader,
        github_username=github_user
        )
    
        
    data=teammatesearch.objects.all()
   
    context={
        'ans': 'request sent successfully',
        'data':data
    }
    return render(request, 'teamsearch.html',context)
    
    
        